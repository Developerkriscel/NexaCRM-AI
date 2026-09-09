package com.nexacrm.service;

import com.nexacrm.dto.LeadActivityDTO;
import com.nexacrm.exception.ResourceNotFoundException;
import com.nexacrm.model.Lead;
import com.nexacrm.model.LeadActivity;
import com.nexacrm.repository.LeadActivityRepository;
import com.nexacrm.repository.LeadRepository;
import com.nexacrm.repository.UserRepository;
import com.nexacrm.security.TenantContext;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.Locale;
import java.util.Optional;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Transactional
public class LeadActivityService {

    private Long tenantId() {
        return TenantContext.currentTenantId();
    }

    private final LeadActivityRepository leadActivityRepository;
    private final LeadRepository leadRepository;
    private final UserRepository userRepository;

    @Transactional(readOnly = true)
    public List<LeadActivityDTO> listByLeadId(String leadId) {
        ensureLeadVisible(ensureLeadExists(leadId));
        return leadActivityRepository
            .findByLeadIdAndTenantIdAndDeletedFalseOrderBySavedAtDesc(leadId, tenantId())
            .stream()
            .map(this::toDTO)
            .collect(Collectors.toList());
    }

    public LeadActivityDTO create(String leadId, LeadActivityDTO dto) {
        Lead lead = ensureLeadExists(leadId);
        ensureLeadVisible(lead);
        LocalDateTime now = LocalDateTime.now();
        LocalDateTime savedAt = dto.getSavedAt() != null ? dto.getSavedAt() : now;
        Map<String, Object> values = dto.getValues() != null ? new LinkedHashMap<>(dto.getValues()) : new LinkedHashMap<>();
        String assignedTo = resolveAssignedTo(lead, dto, values);
        applyActivityDefaults(lead, dto, values, savedAt, assignedTo);
        String summary = firstNonBlank(dto.getSummary(), buildSummary(values));

        LeadActivity activity = LeadActivity.builder()
            .leadId(leadId)
            .activityIndex(dto.getActivityIndex())
            .activityId(dto.getActivityId())
            .activityLabel(dto.getActivityLabel())
            .activityTitle(dto.getActivityTitle())
            .assignedTo(assignedTo)
            .summary(summary)
            .values(values)
            .savedAt(savedAt)
            .build();
        activity.setTenantId(tenantId());

        LeadActivity saved = leadActivityRepository.save(activity);

        lead.setLastContactedAt(savedAt);
        List<String> activityLogs = lead.getActivityLogs() != null ? new ArrayList<>(lead.getActivityLogs()) : new ArrayList<>();
        String logEntry = savedAt + " | " + firstNonBlank(dto.getActivityTitle(), dto.getActivityLabel()) + " | " + firstNonBlank(summary, "Activity recorded");
        activityLogs.add(0, logEntry);
        if (activityLogs.size() > 25) {
            activityLogs = activityLogs.subList(0, 25);
        }
        lead.setActivityLogs(activityLogs);
        leadRepository.save(lead);

        return toDTO(saved);
    }

    private Lead ensureLeadExists(String leadId) {
        return leadRepository.findByIdAndTenantIdAndDeletedFalse(leadId, tenantId())
            .orElseThrow(() -> new ResourceNotFoundException("Lead not found: " + leadId));
    }

    private void ensureLeadVisible(Lead lead) {
        if (!canCurrentUserAccess(lead)) {
            throw new ResourceNotFoundException("Lead not found: " + lead.getId());
        }
    }

    private boolean canCurrentUserAccess(Lead lead) {
        var current = currentUser();
        if (current == null || com.nexacrm.model.User.isAdminLike(current.getRole()) || current.getRole() == com.nexacrm.model.User.Role.MANAGER) {
            return true;
        }
        if (current.getId() == null || current.getId().isBlank() || lead == null) {
            return false;
        }
        return lead.getAssignedTo() != null && current.getId().equals(lead.getAssignedTo().getId());
    }

    private String buildSummary(Map<String, Object> values) {
        if (values == null || values.isEmpty()) return "No extra details";
        return values.entrySet().stream()
            .filter(e -> e.getValue() != null && !stringValue(e.getValue()).isBlank())
            .map(e -> e.getKey() + ": " + stringValue(e.getValue()))
            .collect(Collectors.joining(" | "));
    }

    private void applyActivityDefaults(Lead lead, LeadActivityDTO dto, Map<String, Object> values, LocalDateTime savedAt, String assignedTo) {
        if (dto.getActivityIndex() == null || dto.getActivityIndex() != 0) {
            applyGenericDefaults(values, savedAt, assignedTo);
            if (dto.getActivityIndex() != null && dto.getActivityIndex() == 1) {
                applyActivityTwoDefaults(lead, values, savedAt, assignedTo);
            } else if (dto.getActivityIndex() != null && dto.getActivityIndex() == 2) {
                applyActivityThreeDefaults(lead, values, savedAt, assignedTo);
            } else if (dto.getActivityIndex() != null && dto.getActivityIndex() == 3) {
                applyActivityFourDefaults(lead, values, savedAt, assignedTo);
            }
            return;
        }

        LocalDateTime plannedDate = lead.getCreatedAt() != null ? lead.getCreatedAt() : savedAt;
        String source = lead.getSource() != null ? lead.getSource().name() : stringValue(values.get("source"));
        String serviceRequirement = firstNonBlank(lead.getService(), lead.getSpecialization(), stringValue(values.get("serviceRequirement")));
        String connectionStatus = normalizeConnectionStatus(
            firstNonBlank(
                stringValue(values.get("connectionStatus")),
                stringValue(values.get("callOutcome")),
                stringValue(values.get("status"))
            )
        );
        String remarks = firstNonBlank(
            stringValue(values.get("remark")),
            stringValue(values.get("remarks")),
            stringValue(values.get("note"))
        );
        String nextFollowUpDate = firstNonBlank(
            stringValue(values.get("nextFollowUpDate")),
            stringValue(values.get("followUpDate"))
        );
        double delayHours = Math.abs(Duration.between(plannedDate, savedAt).toMinutes() / 60.0);

        values.put("source", source);
        values.put("serviceRequirement", serviceRequirement);
        values.put("plannedDate", plannedDate.toString());
        values.put("actualDate", savedAt.toString());
        values.put("actual", savedAt.toString());
        values.put("delayHours", roundOneDecimal(delayHours));
        values.put("delay", roundOneDecimal(delayHours));
        values.put("actualDateStatus", computeActualDateStatus(plannedDate, savedAt));
        values.put("assignedTo", assignedTo);

        if (!connectionStatus.isBlank()) {
            values.put("connectionStatus", connectionStatus);
            values.put("callOutcome", connectionStatus);
        }
        if (!remarks.isBlank()) {
            values.put("remark", remarks);
            values.put("remarks", remarks);
        }
        if (!nextFollowUpDate.isBlank()) {
            values.put("nextFollowUpDate", nextFollowUpDate);
            values.put("followUpDate", nextFollowUpDate);
        }
    }

    private void applyGenericDefaults(Map<String, Object> values, LocalDateTime savedAt, String assignedTo) {
        values.put("actualDate", savedAt.toString());
        values.put("actual", savedAt.toString());
        values.put("actualDateStatus", "On Time");
        if (assignedTo != null && !assignedTo.isBlank()) {
            values.putIfAbsent("assignedTo", assignedTo);
        }
    }

    private void applyActivityTwoDefaults(Lead lead, Map<String, Object> values, LocalDateTime savedAt, String assignedTo) {
        LocalDateTime plannedDate = resolvePreviousActivityActualDate(lead.getId(), 0)
            .orElseGet(() -> lead.getCreatedAt() != null ? lead.getCreatedAt() : savedAt);
        String status = normalizeActivityTwoStatus(firstNonBlank(
            stringValue(values.get("status")),
            stringValue(values.get("remarkStatus"))
        ));
        String remark = firstNonBlank(stringValue(values.get("remark")), stringValue(values.get("remarks")), stringValue(values.get("note")));
        String nextFollowUpDate = firstNonBlank(stringValue(values.get("nextFollowUpDate")), stringValue(values.get("followUpDate")));
        double delayHours = Math.abs(Duration.between(plannedDate, savedAt).toMinutes() / 60.0);

        values.put("plannedDate", plannedDate.toString());
        values.put("actualDate", savedAt.toString());
        values.put("actual", savedAt.toString());
        values.put("delayHours", roundOneDecimal(delayHours));
        values.put("delay", roundOneDecimal(delayHours));
        values.put("actualDateStatus", computeActualDateStatus(plannedDate, savedAt));
        values.put("assignedTo", assignedTo);

        if (!status.isBlank()) {
            values.put("status", status);
        }
        if (!remark.isBlank()) {
            values.put("remark", remark);
            values.put("remarks", remark);
        }
        if (!nextFollowUpDate.isBlank()) {
            values.put("nextFollowUpDate", nextFollowUpDate);
            values.put("followUpDate", nextFollowUpDate);
        }
    }

    private void applyActivityThreeDefaults(Lead lead, Map<String, Object> values, LocalDateTime savedAt, String assignedTo) {
        LocalDateTime plannedDate = resolvePreviousActivityActualDate(lead.getId(), 1)
            .orElseGet(() -> lead.getCreatedAt() != null ? lead.getCreatedAt() : savedAt);
        String status = normalizeActivityThreeStatus(firstNonBlank(
            stringValue(values.get("status")),
            stringValue(values.get("meetingStatus"))
        ));
        String remark = firstNonBlank(stringValue(values.get("remark")), stringValue(values.get("remarks")), stringValue(values.get("note")));
        double delayHours = Math.abs(Duration.between(plannedDate, savedAt).toMinutes() / 60.0);

        values.put("plannedDate", plannedDate.toString());
        values.put("actualDate", savedAt.toString());
        values.put("actual", savedAt.toString());
        values.put("delayHours", roundOneDecimal(delayHours));
        values.put("delay", roundOneDecimal(delayHours));
        values.put("actualDateStatus", computeActualDateStatus(plannedDate, savedAt));
        values.put("assignedTo", assignedTo);

        if (!status.isBlank()) {
            values.put("status", status);
            values.put("meetingStatus", status);
        }
        if (!remark.isBlank()) {
            values.put("remark", remark);
            values.put("remarks", remark);
        }
    }

    private void applyActivityFourDefaults(Lead lead, Map<String, Object> values, LocalDateTime savedAt, String assignedTo) {
        LocalDateTime plannedDate = resolvePreviousActivityActualDate(lead.getId(), 2)
            .orElseGet(() -> lead.getCreatedAt() != null ? lead.getCreatedAt() : savedAt);
        String status = normalizeActivityFourStatus(firstNonBlank(
            stringValue(values.get("status")),
            stringValue(values.get("outcome"))
        ));
        String remark = firstNonBlank(
            stringValue(values.get("remark")),
            stringValue(values.get("remarks")),
            stringValue(values.get("note")),
            stringValue(values.get("remarkFollowUp")),
            stringValue(values.get("remarkWon")),
            stringValue(values.get("remarkLost"))
        );
        String followUpDate = firstNonBlank(
            stringValue(values.get("followUpDate")),
            stringValue(values.get("nextFollowUpDate"))
        );
        String lostCategory = firstNonBlank(stringValue(values.get("lostCategory")));
        String paymentReceived = firstNonBlank(stringValue(values.get("paymentReceived")));
        String meetingPriceFinal = firstNonBlank(stringValue(values.get("meetingPriceFinal")));
        String calendarStatus = firstNonBlank(stringValue(values.get("calendarStatus")));
        double delayHours = Math.abs(Duration.between(plannedDate, savedAt).toMinutes() / 60.0);

        values.put("plannedDate", plannedDate.toString());
        values.put("actualDate", savedAt.toString());
        values.put("actual", savedAt.toString());
        values.put("delayHours", roundOneDecimal(delayHours));
        values.put("delay", roundOneDecimal(delayHours));
        values.put("actualDateStatus", computeActualDateStatus(plannedDate, savedAt));
        values.put("assignedTo", assignedTo);

        if (!status.isBlank()) {
            values.put("status", status);
        }
        if (!remark.isBlank()) {
            values.put("remark", remark);
            values.put("remarks", remark);
        }
        if (!followUpDate.isBlank()) {
            values.put("followUpDate", followUpDate);
            values.put("nextFollowUpDate", followUpDate);
        }
        if (!lostCategory.isBlank()) {
            values.put("lostCategory", lostCategory);
        }
        if (!paymentReceived.isBlank()) {
            values.put("paymentReceived", paymentReceived);
        }
        if (!meetingPriceFinal.isBlank()) {
            values.put("meetingPriceFinal", meetingPriceFinal);
        }
        if (!calendarStatus.isBlank()) {
            values.put("calendarStatus", calendarStatus);
        }
    }

    private Optional<LocalDateTime> resolvePreviousActivityActualDate(String leadId, int activityIndex) {
        return leadActivityRepository.findByLeadIdAndTenantIdAndDeletedFalseOrderBySavedAtDesc(leadId, tenantId()).stream()
            .filter(activity -> activity.getActivityIndex() != null && activity.getActivityIndex() == activityIndex)
            .findFirst()
            .map(this::extractActivityActualDate);
    }

    private LocalDateTime extractActivityActualDate(LeadActivity activity) {
        if (activity == null) return null;
        Map<String, Object> values = activity.getValues();
        String raw = firstNonBlank(
            values != null ? stringValue(values.get("actualDate")) : null,
            values != null ? stringValue(values.get("actual")) : null,
            activity.getSavedAt() != null ? activity.getSavedAt().toString() : null
        );
        if (raw == null || raw.isBlank()) return null;
        try {
            return LocalDateTime.parse(raw);
        } catch (Exception ignored) {
            return activity.getSavedAt();
        }
    }

    private String resolveAssignedTo(Lead lead, LeadActivityDTO dto, Map<String, Object> values) {
        String explicit = firstNonBlank(dto.getAssignedTo(), stringValue(values.get("assignedTo")));
        if (explicit != null) {
            return explicit;
        }
        if (lead.getAssignedTo() != null) {
            return firstNonBlank(lead.getAssignedTo().getName(), lead.getAssignedTo().getEmail());
        }
        String currentUser = currentUserName();
        return currentUser != null ? currentUser : "Sales Team";
    }

    private String currentUserName() {
        com.nexacrm.model.User current = currentUser();
        return current != null ? firstNonBlank(current.getName(), current.getEmail()) : null;
    }

    private com.nexacrm.model.User currentUser() {
        String email = SecurityContextHolder.getContext().getAuthentication().getName();
        return userRepository.findByEmailAndTenantIdAndDeletedFalse(email, tenantId())
            .orElse(null);
    }

    private String normalizeConnectionStatus(String value) {
        String normalized = stringValue(value).toLowerCase(Locale.ROOT);
        if (normalized.contains("non")) return "Non Connected";
        if (normalized.contains("connect")) return "Connected";
        return "";
    }

    private String normalizeActivityTwoStatus(String value) {
        String normalized = stringValue(value).toLowerCase(Locale.ROOT);
        if (normalized.contains("meeting")) return "Meeting";
        if (normalized.contains("follow")) return "Follow Up";
        if (normalized.contains("not")) return "Not Interested";
        return "";
    }

    private String normalizeActivityThreeStatus(String value) {
        String normalized = stringValue(value).toLowerCase(Locale.ROOT);
        if (normalized.contains("success")) return "Successful";
        if (normalized.contains("fail")) return "Failed";
        return "";
    }

    private String normalizeActivityFourStatus(String value) {
        String normalized = stringValue(value).toLowerCase(Locale.ROOT);
        if (normalized.contains("negoti")) return "Negotiation";
        if (normalized.equals("pending")) return "Pending";
        if (normalized.contains("won") || normalized.contains("win")) return "Won";
        if (normalized.contains("lost")) return "Lost";
        if (normalized.contains("hold") || normalized.contains("follow")) return "Hold";
        return "";
    }

    private String computeActualDateStatus(LocalDateTime plannedDate, LocalDateTime actualDate) {
        if (plannedDate == null || actualDate == null) return "On Time";
        long minutes = Duration.between(plannedDate, actualDate).toMinutes();
        if (Math.abs(minutes) < 1) return "On Time";
        if (minutes > 0) return "Delayed";
        return "Early";
    }

    private double roundOneDecimal(double value) {
        return Math.round(value * 10.0) / 10.0;
    }

    private String firstNonBlank(String... values) {
        if (values == null) return null;
        for (String value : values) {
            if (value != null && !value.isBlank()) {
                return value.trim();
            }
        }
        return null;
    }

    private String stringValue(Object value) {
        return value == null ? "" : String.valueOf(value).trim();
    }

    private LeadActivityDTO toDTO(LeadActivity activity) {
        return LeadActivityDTO.builder()
            .id(activity.getId())
            .leadId(activity.getLeadId())
            .activityIndex(activity.getActivityIndex())
            .activityId(activity.getActivityId())
            .activityLabel(activity.getActivityLabel())
            .activityTitle(activity.getActivityTitle())
            .assignedTo(activity.getAssignedTo())
            .summary(activity.getSummary())
            .values(activity.getValues())
            .savedAt(activity.getSavedAt())
            .createdAt(activity.getCreatedAt())
            .updatedAt(activity.getUpdatedAt())
            .build();
    }
}
