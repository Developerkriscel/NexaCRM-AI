package com.nexacrm.service.dashboard;

import com.nexacrm.dto.DealDTO;
import com.nexacrm.dto.LeadDTO;
import com.nexacrm.dto.PageResponse;
import com.nexacrm.dto.dashboard.DashboardOverviewDTO;
import com.nexacrm.dto.dashboard.DashboardWidgetSnapshotDTO;
import com.nexacrm.model.CommunicationRecord;
import com.nexacrm.model.Lead;
import com.nexacrm.model.LeadActivity;
import com.nexacrm.model.User;
import com.nexacrm.repository.CommunicationRecordRepository;
import com.nexacrm.repository.LeadActivityRepository;
import com.nexacrm.security.TenantContext;
import com.nexacrm.service.AIService;
import com.nexacrm.service.CallAgentService;
import com.nexacrm.service.DealService;
import com.nexacrm.service.LeadService;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.Duration;
import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.temporal.TemporalAdjusters;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class DashboardAnalyticsService {

    private static final int PAGE_SIZE = 250;
    private static final int DASHBOARD_MONTHS = 6;
    private static final List<DashboardStage> DASHBOARD_STAGES = List.of(
        new DashboardStage("NEW", "New Leads", "#7c3aed"),
        new DashboardStage("CONTACTED", "Contacted", "#9333ea"),
        new DashboardStage("QUALIFIED", "Qualified", "#c026d3"),
        new DashboardStage("PROPOSAL", "Proposal", "#db2777"),
        new DashboardStage("NEGOTIATION", "Negotiation", "#f59e0b"),
        new DashboardStage("WON", "Won", "#10b981")
    );
    private static final Map<String, String> LEAD_SOURCE_COLORS = Map.ofEntries(
        Map.entry("facebook", "#1877f2"),
        Map.entry("instagram", "#e1306c"),
        Map.entry("linkedin", "#0077b5"),
        Map.entry("website", "#8b5cf6"),
        Map.entry("whatsapp", "#25d366"),
        Map.entry("referral", "#f59e0b"),
        Map.entry("email", "#0ea5e9"),
        Map.entry("google ads", "#f97316"),
        Map.entry("meta ads", "#ec4899")
    );
    private static final List<String> SOURCE_ORDER = List.of(
        "Facebook",
        "Instagram",
        "LinkedIn",
        "WhatsApp",
        "Website",
        "Google Sheet",
        "Manual Entry",
        "Google Ads",
        "Meta Ads",
        "Referral",
        "Email",
        "Other"
    );

    private final LeadService leadService;
    private final DealService dealService;
    private final AIService aiService;
    private final CallAgentService callAgentService;
    private final MongoTemplate mongoTemplate;
    private final LeadActivityRepository leadActivityRepository;
    private final CommunicationRecordRepository communicationRecordRepository;

    private Long tenantId() {
        return TenantContext.currentTenantId();
    }

    public DashboardOverviewDTO overview() {
        List<LeadDTO> leads = fetchAllLeads();
        List<DealDTO> deals = fetchAllDeals();
        List<Map<String, Object>> insights = safeInsights();
        List<Map<String, Object>> recentActivity = buildRecentActivity(leads);
        List<Map<String, Object>> recentCallSnapshots = buildRecentCallSnapshots(leads);

        return new DashboardOverviewDTO(
            leads,
            deals,
            insights,
            recentActivity,
            recentCallSnapshots,
            LocalDateTime.now().toString()
        );
    }

    public DashboardWidgetSnapshotDTO widgets() {
        List<LeadDTO> leads = fetchAllLeads();
        List<DealDTO> deals = fetchAllDeals();
        List<Lead> leadEntities = fetchLeadEntities();

        DashboardWidgetSnapshotDTO.AgingCounts agingCounts = buildAgingCounts(leadEntities);
        DashboardWidgetSnapshotDTO.LeadSlaSummary slaSummary = buildSlaSummary(leadEntities);
        List<DashboardWidgetSnapshotDTO.EmployeePerformance> employeePerformance = buildEmployeePerformance(leadEntities);
        List<DashboardWidgetSnapshotDTO.RevenueBucket> monthlyRevenue = buildMonthlyRevenue(deals);
        List<DashboardWidgetSnapshotDTO.FunnelStage> funnelData = buildFunnelData(leadEntities);
        List<DashboardWidgetSnapshotDTO.LeadSourceShare> leadSources = buildLeadSources(leadEntities);

        return new DashboardWidgetSnapshotDTO(
            agingCounts,
            slaSummary,
            employeePerformance,
            monthlyRevenue,
            funnelData,
            leadSources,
            LocalDateTime.now().toString()
        );
    }

    private List<LeadDTO> fetchAllLeads() {
        List<LeadDTO> all = new ArrayList<>();
        int page = 0;
        int totalPages = 1;
        do {
            PageResponse<LeadDTO> response = leadService.findAll(
                null,
                null,
                null,
                null,
                null,
                PageRequest.of(page, PAGE_SIZE, Sort.by(Sort.Direction.DESC, "createdAt"))
            );
            if (response.getContent() != null) {
                all.addAll(response.getContent());
            }
            totalPages = Math.max(1, response.getTotalPages());
            page += 1;
        } while (page < totalPages);
        return all;
    }

    private List<DealDTO> fetchAllDeals() {
        List<DealDTO> all = new ArrayList<>();
        int page = 0;
        int totalPages = 1;
        do {
            PageResponse<DealDTO> response = dealService.findAll(
                null,
                null,
                null,
                PageRequest.of(page, PAGE_SIZE, Sort.by(Sort.Direction.DESC, "updatedAt"))
            );
            if (response.getContent() != null) {
                all.addAll(response.getContent());
            }
            totalPages = Math.max(1, response.getTotalPages());
            page += 1;
        } while (page < totalPages);
        return all;
    }

    private List<Lead> fetchLeadEntities() {
        List<Lead> all = new ArrayList<>();
        int page = 0;
        Query countQuery = new Query();
        countQuery.addCriteria(Criteria.where("tenant_id").is(tenantId()));
        countQuery.addCriteria(Criteria.where("deleted").is(false));
        long total = mongoTemplate.count(countQuery, Lead.class);
        int totalPages = Math.max(1, (int) Math.ceil((double) total / PAGE_SIZE));
        do {
            Query query = new Query();
            query.addCriteria(Criteria.where("tenant_id").is(tenantId()));
            query.addCriteria(Criteria.where("deleted").is(false));
            query.with(PageRequest.of(page, PAGE_SIZE, Sort.by(Sort.Direction.DESC, "createdAt")));
            List<Lead> pageRows = mongoTemplate.find(query, Lead.class);
            all.addAll(pageRows);
            page += 1;
        } while (page < totalPages);
        return all;
    }

    private List<Map<String, Object>> safeInsights() {
        try {
            return aiService.generateInsights();
        } catch (Exception ex) {
            return List.of(Map.of(
                "id", "insights-fallback",
                "type", "warning",
                "title", "Insights temporarily unavailable",
                "body", "AI insights are currently unavailable. The dashboard will keep showing live CRM data.",
                "action", "Dashboard"
            ));
        }
    }

    private List<Map<String, Object>> buildRecentActivity(List<LeadDTO> leads) {
        List<LeadDTO> recentLeads = leads.stream()
            .sorted(Comparator.comparing(this::leadTimestamp, Comparator.nullsLast(Comparator.naturalOrder())).reversed())
            .limit(4)
            .toList();

        List<Map<String, Object>> feed = new ArrayList<>();
        for (LeadDTO lead : recentLeads) {
            List<LeadActivity> activities = leadActivityRepository
                .findByLeadIdAndTenantIdAndDeletedFalseOrderBySavedAtDesc(lead.getId(), tenantId());

            for (LeadActivity activity : activities.stream().limit(2).toList()) {
                feed.add(activityRow(lead, activity));
            }

            feed.add(leadRow(lead));
        }

        return feed.stream()
            .sorted(Comparator.comparing((Map<String, Object> row) -> parseTimestamp(String.valueOf(row.get("timestamp"))),
                    Comparator.nullsLast(Comparator.naturalOrder()))
                .reversed())
            .limit(7)
            .toList();
    }

    private Map<String, Object> leadRow(LeadDTO lead) {
        LocalDateTime timestamp = leadTimestamp(lead);
        String source = formatSourceLabel(String.valueOf(lead.getSource() != null ? lead.getSource().name() : "OTHER"));
        String user = lead.getAssignedToName() != null && !lead.getAssignedToName().isBlank()
            ? lead.getAssignedToName()
            : "System";

        Map<String, Object> row = new LinkedHashMap<>();
        row.put("id", "lead-" + lead.getId());
        row.put("type", "lead");
        row.put("text", "Lead " + safeText(lead.getName(), "Unnamed lead") + " from " + source + " is " + safeText(lead.getStatus() != null ? lead.getStatus().name() : "NEW", "NEW").toLowerCase(Locale.ROOT));
        row.put("time", formatRelativeTime(timestamp));
        row.put("user", user);
        row.put("avatar", avatarFor(user));
        row.put("timestamp", timestamp != null ? timestamp.toString() : "");
        return row;
    }

    private Map<String, Object> activityRow(LeadDTO lead, LeadActivity activity) {
        LocalDateTime timestamp = activity.getSavedAt();
        String assignedTo = safeText(activity.getAssignedTo(), lead.getAssignedToName() != null ? lead.getAssignedToName() : "System");
        String summary = safeText(activity.getSummary(), activity.getActivityTitle() != null ? activity.getActivityTitle() : "Activity updated");

        Map<String, Object> row = new LinkedHashMap<>();
        row.put("id", activity.getId() != null ? activity.getId() : lead.getId() + "-" + activity.getActivityId());
        row.put("type", safeText(activity.getActivityTitle(), "note").toLowerCase(Locale.ROOT));
        row.put("text", summary);
        row.put("time", formatRelativeTime(timestamp));
        row.put("user", assignedTo);
        row.put("avatar", avatarFor(assignedTo));
        row.put("timestamp", timestamp != null ? timestamp.toString() : "");
        return row;
    }

    private List<Map<String, Object>> buildRecentCallSnapshots(List<LeadDTO> leads) {
        List<LeadDTO> sortedLeads = leads.stream()
            .sorted(Comparator.comparing(this::leadTimestamp, Comparator.nullsLast(Comparator.naturalOrder())).reversed())
            .limit(5)
            .toList();

        List<Map<String, Object>> snapshots = new ArrayList<>();
        for (LeadDTO lead : sortedLeads) {
            List<CommunicationRecord> calls = communicationRecordRepository
                .findTop50ByLeadIdAndChannelIgnoreCaseOrderByCreatedAtDesc(lead.getId(), "CALL");
            if (calls.isEmpty()) {
                continue;
            }

            try {
                Map<String, Object> intelligence = callAgentService.getLeadCallIntelligence(lead.getId());
                Map<String, Object> analysis = asMap(intelligence.get("analysis"));
                List<Map<String, Object>> history = asMapList(intelligence.get("calls"));
                Map<String, Object> latest = history.isEmpty() ? Map.of() : history.get(0);

                String leadName = safeText(String.valueOf(((Map<?, ?>) intelligence.getOrDefault("lead", Map.of())).get("name")), lead.getName());
                String company = safeText(String.valueOf(((Map<?, ?>) intelligence.getOrDefault("lead", Map.of())).get("company")), lead.getCompany());
                String currentStatus = safeText(String.valueOf(((Map<?, ?>) intelligence.getOrDefault("lead", Map.of())).get("status")), lead.getStatus() != null ? lead.getStatus().name() : "NEW");

                Map<String, Object> snapshot = new LinkedHashMap<>();
                snapshot.put("leadId", lead.getId());
                snapshot.put("leadName", leadName);
                snapshot.put("company", company);
                snapshot.put("currentStatus", currentStatus);
                snapshot.put("verdict", safeText(String.valueOf(analysis.getOrDefault("leadVerdict", "UNCERTAIN")), "UNCERTAIN"));
                snapshot.put("confidence", toNumber(analysis.get("confidence")));
                snapshot.put("summary", safeText(String.valueOf(analysis.getOrDefault("summary", latest.getOrDefault("summary", "No summary available yet."))), "No summary available yet."));
                snapshot.put("recordingUrl", safeText(String.valueOf(latest.getOrDefault("recordingUrl", "")), ""));
                snapshot.put("calledAt", safeText(String.valueOf(latest.getOrDefault("createdAt", lead.getLastContactedAt())), ""));
                snapshots.add(snapshot);
            } catch (Exception ignored) {
                // Best effort: skip malformed intelligence payloads and keep the dashboard responsive.
            }

            if (snapshots.size() >= 3) {
                break;
            }
        }

        return snapshots;
    }

    private DashboardWidgetSnapshotDTO.AgingCounts buildAgingCounts(List<Lead> leads) {
        long fresh = 0;
        long warning = 0;
        long critical = 0;
        for (Lead lead : leads) {
            switch (agingLevel(lead)) {
                case "fresh" -> fresh++;
                case "warning" -> warning++;
                case "critical" -> critical++;
                default -> { }
            }
        }
        return new DashboardWidgetSnapshotDTO.AgingCounts(fresh, warning, critical);
    }

    private DashboardWidgetSnapshotDTO.LeadSlaSummary buildSlaSummary(List<Lead> leads) {
        List<Double> responseSamples = new ArrayList<>();
        long unattendedCritical = 0;
        long pending = 0;
        long met = 0;
        long breached = 0;

        Map<String, LocalDateTime> firstResponseByLead = fetchFirstResponseByLeadId(leads);
        for (Lead lead : leads) {
            if ("critical".equals(agingLevel(lead))) {
                unattendedCritical++;
            }

            Double responseMinutes = responseMinutes(lead, firstResponseByLead.get(lead.getId()));
            if (responseMinutes == null) {
                pending++;
                continue;
            }

            responseSamples.add(responseMinutes);
            if (responseMinutes <= leadSlaMinutes(lead)) {
                met++;
            } else {
                breached++;
            }
        }

        Double average = responseSamples.isEmpty()
            ? null
            : round(responseSamples.stream().mapToDouble(Double::doubleValue).average().orElse(0.0));

        return new DashboardWidgetSnapshotDTO.LeadSlaSummary(
            leads.size(),
            unattendedCritical,
            pending,
            met,
            breached,
            average
        );
    }

    private List<DashboardWidgetSnapshotDTO.EmployeePerformance> buildEmployeePerformance(List<Lead> leads) {
        Map<String, List<Lead>> byOwner = new LinkedHashMap<>();
        for (Lead lead : leads) {
            String owner = leadOwnerName(lead);
            byOwner.computeIfAbsent(owner, key -> new ArrayList<>()).add(lead);
        }

        Map<String, LocalDateTime> firstResponseByLead = fetchFirstResponseByLeadId(leads);
        List<DashboardWidgetSnapshotDTO.EmployeePerformance> rows = new ArrayList<>();
        for (Map.Entry<String, List<Lead>> entry : byOwner.entrySet()) {
            String owner = entry.getKey();
            List<Lead> ownerLeads = entry.getValue();
            long total = ownerLeads.size();
            long unattended = ownerLeads.stream().filter(lead -> "critical".equals(agingLevel(lead))).count();
            long met = 0;
            long breached = 0;
            long pending = 0;
            for (Lead lead : ownerLeads) {
                Double responseMinutes = responseMinutes(lead, firstResponseByLead.get(lead.getId()));
                if (responseMinutes == null) {
                    pending++;
                } else if (responseMinutes <= leadSlaMinutes(lead)) {
                    met++;
                } else {
                    breached++;
                }
            }
            rows.add(new DashboardWidgetSnapshotDTO.EmployeePerformance(owner, total, unattended, met, breached, pending));
        }

        rows.sort((left, right) -> {
            int compare = Long.compare(right.unattended(), left.unattended());
            if (compare != 0) return compare;
            compare = Long.compare(right.breached(), left.breached());
            if (compare != 0) return compare;
            return String.CASE_INSENSITIVE_ORDER.compare(left.owner(), right.owner());
        });
        return rows.stream().limit(5).toList();
    }

    private List<DashboardWidgetSnapshotDTO.RevenueBucket> buildMonthlyRevenue(List<DealDTO> deals) {
        List<DashboardWidgetSnapshotDTO.RevenueBucket> buckets = new ArrayList<>();
        LocalDate currentMonthStart = LocalDate.now().withDayOfMonth(1);
        for (int i = DASHBOARD_MONTHS - 1; i >= 0; i--) {
            LocalDate start = currentMonthStart.minusMonths(i);
            LocalDate end = start.plusMonths(1);
            double revenue = 0.0;
            long count = 0;
            for (DealDTO deal : deals) {
                LocalDateTime dateTime = dealTimestamp(deal);
                if (dateTime == null) continue;
                LocalDate date = dateTime.toLocalDate();
                if (!date.isBefore(start) && date.isBefore(end) && "WON".equalsIgnoreCase(dealStageKey(deal))) {
                    revenue += dealRevenueValue(deal).doubleValue();
                    count++;
                }
            }
            buckets.add(new DashboardWidgetSnapshotDTO.RevenueBucket(formatMonthLabel(start), round(revenue), count));
        }
        return buckets;
    }

    private List<DashboardWidgetSnapshotDTO.FunnelStage> buildFunnelData(List<Lead> leads) {
        List<DashboardWidgetSnapshotDTO.FunnelStage> stages = new ArrayList<>();
        for (DashboardStage stage : dashboardStages()) {
            long count = leads.stream()
                .filter(lead -> stage.key().equalsIgnoreCase(dashboardStageKey(lead)))
                .count();
            stages.add(new DashboardWidgetSnapshotDTO.FunnelStage(stage.label(), count, stage.color()));
        }
        return stages;
    }

    private List<DashboardWidgetSnapshotDTO.LeadSourceShare> buildLeadSources(List<Lead> leads) {
        Map<String, Long> totals = new LinkedHashMap<>();
        for (String source : SOURCE_ORDER) {
            totals.put(source, 0L);
        }
        for (Lead lead : leads) {
            String label = sourceLabel(lead);
            totals.compute(label, (key, value) -> (value == null ? 0L : value) + 1L);
        }
        long totalLeads = Math.max(1L, leads.size());
        return totals.entrySet().stream()
            .filter(entry -> entry.getValue() != null && entry.getValue() > 0)
            .sorted(Map.Entry.<String, Long>comparingByValue().reversed())
            .limit(6)
            .map(entry -> new DashboardWidgetSnapshotDTO.LeadSourceShare(
                entry.getKey(),
                round((entry.getValue() * 100.0) / totalLeads),
                leadSourceColor(entry.getKey())
            ))
            .toList();
    }

    private Map<String, LocalDateTime> fetchFirstResponseByLeadId(List<Lead> leads) {
        if (leads == null || leads.isEmpty()) {
            return Map.of();
        }
        Set<String> leadIds = leads.stream()
            .map(Lead::getId)
            .filter(id -> id != null && !id.isBlank())
            .collect(Collectors.toCollection(LinkedHashSet::new));
        if (leadIds.isEmpty()) {
            return Map.of();
        }

        Query query = new Query();
        query.addCriteria(Criteria.where("tenant_id").is(tenantId()));
        query.addCriteria(Criteria.where("deleted").is(false));
        query.addCriteria(Criteria.where("lead_id").in(leadIds));
        query.with(Sort.by(Sort.Direction.ASC, "savedAt"));
        List<LeadActivity> activities = mongoTemplate.find(query, LeadActivity.class);

        Map<String, LocalDateTime> firstResponse = new LinkedHashMap<>();
        for (LeadActivity activity : activities) {
            if (activity.getLeadId() == null || firstResponse.containsKey(activity.getLeadId())) {
                continue;
            }
            LocalDateTime timestamp = activity.getSavedAt() != null ? activity.getSavedAt() : activity.getCreatedAt();
            if (timestamp != null) {
                firstResponse.put(activity.getLeadId(), timestamp);
            }
        }
        return firstResponse;
    }

    private Double responseMinutes(Lead lead, LocalDateTime firstResponseAt) {
        LocalDateTime createdAt = lead != null ? lead.getCreatedAt() : null;
        if (createdAt == null || firstResponseAt == null || firstResponseAt.isBefore(createdAt)) {
            return null;
        }
        return Duration.between(createdAt, firstResponseAt).toMinutes() * 1.0;
    }

    private long leadSlaMinutes(Lead lead) {
        return 60L;
    }

    private String agingLevel(Lead lead) {
        if (lead == null || lead.getStatus() == null) {
            return "unknown";
        }
        if (lead.getStatus() != Lead.LeadStatus.NEW) {
            return "resolved";
        }
        LocalDateTime reference = leadReferenceTimestamp(lead);
        if (reference == null) {
            return "unknown";
        }
        long minutes = Math.max(0, Duration.between(reference, LocalDateTime.now()).toMinutes());
        if (minutes <= 15) return "fresh";
        if (minutes <= 60) return "warning";
        return "critical";
    }

    private LocalDateTime leadReferenceTimestamp(Lead lead) {
        if (lead == null) return null;
        return lead.getLastContactedAt() != null
            ? lead.getLastContactedAt()
            : lead.getUpdatedAt() != null
                ? lead.getUpdatedAt()
                : lead.getCreatedAt();
    }

    private String leadOwnerName(Lead lead) {
        if (lead == null || lead.getAssignedTo() == null) {
            return "Unassigned";
        }
        String name = lead.getAssignedTo().getName();
        return name == null || name.isBlank() ? "Unassigned" : name.trim();
    }

    private String dashboardStageKey(Lead lead) {
        if (lead == null || lead.getStatus() == null) {
            return lead != null && lead.getAssignedTo() != null ? "NEW" : "NEW";
        }
        return switch (lead.getStatus()) {
            case NEW -> "NEW";
            case CONTACTED -> "CONTACTED";
            case QUALIFIED -> "QUALIFIED";
            case PROPOSAL -> "PROPOSAL";
            case NEGOTIATION -> "NEGOTIATION";
            case WON -> "WON";
            case LOST -> "LOST";
        };
    }

    private List<DashboardStage> dashboardStages() {
        return DASHBOARD_STAGES;
    }

    private String sourceLabel(Lead lead) {
        if (lead == null || lead.getSource() == null) {
            return "Manual Entry";
        }
        return switch (lead.getSource()) {
            case FACEBOOK -> "Facebook";
            case INSTAGRAM -> "Instagram";
            case LINKEDIN -> "LinkedIn";
            case WEBSITE -> "Website";
            case WHATSAPP -> "WhatsApp";
            case GOOGLE_ADS -> "Google Ads";
            case META_ADS -> "Meta Ads";
            case REFERRAL -> "Referral";
            case EMAIL -> "Email";
            case OTHER -> inferOtherSource(lead);
        };
    }

    private String inferOtherSource(Lead lead) {
        String utmMedium = normalize(lead.getUtmMedium());
        String utmCampaign = normalize(lead.getUtmCampaign());
        String notes = normalize(lead.getNotes());
        if (utmMedium.contains("google_sheet") || utmCampaign.contains("sheet") || notes.contains("sheet")) {
            return "Google Sheet";
        }
        return "Manual Entry";
    }

    private String leadSourceColor(String label) {
        return LEAD_SOURCE_COLORS.getOrDefault(normalize(label), "#8b5cf6");
    }

    private String formatMonthLabel(LocalDate date) {
        if (date == null) return "";
        String month = date.getMonth().name().substring(0, 1) + date.getMonth().name().substring(1).toLowerCase(Locale.ROOT);
        return month;
    }

    private LocalDateTime dealTimestamp(DealDTO deal) {
        if (deal == null) return null;
        if (deal.getActualCloseDate() != null) {
            return deal.getActualCloseDate().atStartOfDay();
        }
        if (deal.getUpdatedAt() != null) return deal.getUpdatedAt();
        return deal.getCreatedAt();
    }

    private String dealStageKey(DealDTO deal) {
        if (deal == null || deal.getStage() == null) {
            return "NEW";
        }
        return deal.getStage().name();
    }

    private BigDecimal dealRevenueValue(DealDTO deal) {
        if (deal == null || deal.getDealValue() == null) {
            return BigDecimal.ZERO;
        }
        return deal.getDealValue();
    }

    private record DashboardStage(String key, String label, String color) {}

    private LocalDateTime leadTimestamp(LeadDTO lead) {
        return lead.getLastContactedAt() != null
            ? lead.getLastContactedAt()
            : lead.getUpdatedAt() != null
                ? lead.getUpdatedAt()
                : lead.getCreatedAt();
    }

    private String formatRelativeTime(LocalDateTime timestamp) {
        if (timestamp == null) {
            return "Just now";
        }
        long diffMinutes = Math.max(0, Duration.between(timestamp, LocalDateTime.now()).toMinutes());
        if (diffMinutes < 1) return "Just now";
        if (diffMinutes < 60) return diffMinutes + " min ago";
        long hours = diffMinutes / 60;
        if (hours < 24) return hours + " hr ago";
        long days = hours / 24;
        return days + " day" + (days == 1 ? "" : "s") + " ago";
    }

    private String avatarFor(String name) {
        String text = safeText(name, "S").trim();
        return text.isBlank() ? "S" : text.substring(0, 1).toUpperCase(Locale.ROOT);
    }

    private String formatSourceLabel(String source) {
        String text = safeText(source, "Other").trim();
        if (text.isBlank()) return "Other";
        return String.valueOf(text.charAt(0)).toUpperCase(Locale.ROOT) + text.substring(1).toLowerCase(Locale.ROOT);
    }

    private String safeText(String value, String fallback) {
        return value == null || value.isBlank() ? fallback : value.trim();
    }

    private String normalize(String value) {
        return value == null ? "" : value.trim().toLowerCase(Locale.ROOT);
    }

    private double round(double value) {
        return BigDecimal.valueOf(value).setScale(2, java.math.RoundingMode.HALF_UP).doubleValue();
    }

    private LocalDateTime parseTimestamp(String value) {
        if (value == null || value.isBlank()) return null;
        try {
            return LocalDateTime.parse(value);
        } catch (Exception ex) {
            return null;
        }
    }

    @SuppressWarnings("unchecked")
    private Map<String, Object> asMap(Object value) {
        if (value instanceof Map<?, ?> map) {
            Map<String, Object> out = new LinkedHashMap<>();
            map.forEach((k, v) -> out.put(String.valueOf(k), v));
            return out;
        }
        return Map.of();
    }

    @SuppressWarnings("unchecked")
    private List<Map<String, Object>> asMapList(Object value) {
        if (value instanceof List<?> list) {
            List<Map<String, Object>> out = new ArrayList<>();
            for (Object item : list) {
                out.add(asMap(item));
            }
            return out;
        }
        return List.of();
    }

    private Number toNumber(Object value) {
        if (value instanceof Number number) {
            return number;
        }
        try {
            return value == null ? 0 : Double.parseDouble(String.valueOf(value));
        } catch (Exception ex) {
            return 0;
        }
    }
}
