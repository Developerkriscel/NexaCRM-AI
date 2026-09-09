package com.nexacrm.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.nexacrm.automation.WorkflowEngine;
import com.nexacrm.dto.LeadDTO;
import com.nexacrm.dto.PageResponse;
import com.nexacrm.exception.ResourceNotFoundException;
import com.nexacrm.model.Customer;
import com.nexacrm.model.Deal;
import com.nexacrm.model.Lead;
import com.nexacrm.model.User;
import com.nexacrm.repository.CustomerRepository;
import com.nexacrm.repository.DealRepository;
import com.nexacrm.repository.LeadRepository;
import com.nexacrm.repository.UserRepository;
import com.nexacrm.security.TenantContext;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.apache.poi.ss.usermodel.Row;
import org.apache.poi.ss.usermodel.Sheet;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.data.mongodb.core.query.TextCriteria;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.client.RestClientException;
import org.springframework.web.client.RestClientResponseException;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.util.UriComponentsBuilder;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.math.BigDecimal;
import java.net.URI;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.HashMap;
import java.util.LinkedHashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Locale;
import java.util.Optional;
import java.util.Set;
import java.util.StringJoiner;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Slf4j
@Transactional
public class LeadService {

    private final LeadRepository leadRepository;
    private final CustomerRepository customerRepository;
    private final DealRepository dealRepository;
    private final UserRepository userRepository;
    private final MongoTemplate mongoTemplate;
    private final NotificationService notificationService;
    private final WorkflowEngine workflowEngine;
    private final CommunicationService communicationService;
    private final IntegrationService integrationService;
    private final RestTemplate restTemplate;
    private final ObjectMapper objectMapper;

    @Value("${meta.page-access-token}")
    private String pageAccessToken;

    @Value("${meta.graph-api-version:v19.0}")
    private String graphApiVersion;

    // ── Queries ──────────────────────────────────────────────────

    private Long tenantId() {
        return TenantContext.currentTenantId();
    }

    private User currentUser() {
        String email = org.springframework.security.core.context.SecurityContextHolder.getContext().getAuthentication().getName();
        return userRepository.findByEmailAndTenantIdAndDeletedFalse(email, tenantId())
            .orElseThrow(() -> new ResourceNotFoundException("Authenticated user not found"));
    }

    @Transactional(readOnly = true)
    public PageResponse<LeadDTO> findAll(String search, String status, String score,
                                         String source, String assignedTo, Pageable pageable) {
        Query query = new Query();
        query.addCriteria(Criteria.where("tenant_id").is(tenantId()));
        query.addCriteria(Criteria.where("deleted").is(false));
        User current = currentUser();
        if (!User.isAdminLike(current.getRole()) && current.getRole() != User.Role.MANAGER) {
            query.addCriteria(Criteria.where("assigned_to.$id").is(current.getId()));
        }

        if (search != null && !search.isBlank()) {
            query.addCriteria(TextCriteria.forDefaultLanguage().matchingAny(search.trim()));
        }
        if (status != null && !status.isBlank()) {
            query.addCriteria(Criteria.where("status").is(Lead.LeadStatus.valueOf(status.toUpperCase())));
        }
        if (score != null && !score.isBlank()) {
            query.addCriteria(Criteria.where("score").is(Lead.LeadScore.valueOf(score.toUpperCase())));
        }
        if (source != null && !source.isBlank()) {
            query.addCriteria(Criteria.where("source").is(Lead.LeadSource.valueOf(source.toUpperCase())));
        }
        if (assignedTo != null && !assignedTo.isBlank()) {
            query.addCriteria(Criteria.where("assigned_to.$id").is(assignedTo));
        }

        long total = mongoTemplate.count(query, Lead.class);
        query.with(pageable);
        List<Lead> leads = mongoTemplate.find(query, Lead.class);
        Page<Lead> page = new PageImpl<>(leads, pageable, total);
        Set<String> assignedIds = page.getContent().stream()
            .map(lead -> lead.getAssignedTo() != null ? lead.getAssignedTo().getId() : null)
            .filter(id -> id != null && !id.isBlank())
            .collect(Collectors.toCollection(LinkedHashSet::new));

        Map<String, String> assignedNameById = assignedIds.isEmpty()
            ? Map.of()
            : userRepository.findAllById(assignedIds).stream()
                .collect(Collectors.toMap(
                    user -> user.getId(),
                    user -> user.getName(),
                    (existing, replacement) -> existing
                ));

        return PageResponse.<LeadDTO>builder()
            .content(page.getContent().stream()
                .map(lead -> toDTO(lead, assignedNameById))
                .collect(Collectors.toList()))
            .page(page.getNumber())
            .size(page.getSize())
            .total(page.getTotalElements())
            .totalPages(page.getTotalPages())
            .first(page.isFirst())
            .last(page.isLast())
            .build();
    }

    @Transactional(readOnly = true)
    public LeadDTO findById(String id) {
        Lead lead = leadRepository.findByIdAndTenantIdAndDeletedFalse(id, tenantId())
            .orElseThrow(() -> new ResourceNotFoundException("Lead not found: " + id));
        ensureLeadVisible(lead);
        return toDTO(lead);
    }

    // ── Commands ─────────────────────────────────────────────────

    public LeadDTO create(LeadDTO dto) {
        String normalizedEmail = normalizeEmail(dto.getEmail());
        if (normalizedEmail == null || normalizedEmail.isBlank()) {
            throw new IllegalStateException("Email is required");
        }
        String normalizedPhone = normalizePhone(dto.getPhone());

        Long tenantId = tenantId();
        if (dto.getFacebookLeadId() != null && !dto.getFacebookLeadId().isBlank()) {
            Optional<Lead> existingFacebookLead = leadRepository.findByFacebookLeadIdAndTenantIdAndDeletedFalse(
                dto.getFacebookLeadId().trim(),
                tenantId
            );
            if (existingFacebookLead.isPresent()) {
                Lead existing = existingFacebookLead.get();
                log.info("Lead create skipped because Facebook lead already exists: id={}", existing.getId());
                return toDTO(existing);
            }
        }

        leadRepository.findByEmailAndTenantIdAndDeletedFalse(normalizedEmail, tenantId)
            .ifPresent(existing -> {
                throw new IllegalStateException("Lead with email already exists: " + normalizedEmail);
            });
        if (normalizedPhone != null && !normalizedPhone.isBlank()) {
            leadRepository.findByPhoneAndTenantIdAndDeletedFalse(normalizedPhone, tenantId)
                .ifPresent(existing -> {
                    throw new IllegalStateException("Lead with phone already exists: " + normalizedPhone);
                });
        }

        dto.setEmail(normalizedEmail);
        dto.setPhone(normalizedPhone);

        Lead lead = fromDTO(dto);
        lead.setTenantId(tenantId);
        validateLostReason(lead);
        Lead saved;
        try {
            saved = leadRepository.save(lead);
        } catch (DuplicateKeyException ex) {
            throw new IllegalStateException("Lead already exists with that email, phone, or external ID", ex);
        }

        notificationService.notifyLeadCreated(
            saved.getName(),
            saved.getSource() != null ? saved.getSource().name() : "OTHER",
            saved.getId()
        );
        workflowEngine.processEvent("LEAD_CREATED", Map.of(
            "leadId", saved.getId(),
            "leadEmail", saved.getEmail() != null ? saved.getEmail() : "",
            "leadPhone", saved.getPhone() != null ? saved.getPhone() : "",
            "source", saved.getSource() != null ? saved.getSource().name() : "OTHER",
            "status", saved.getStatus() != null ? saved.getStatus().name() : "NEW"
        ));
        communicationService.autoCallNewLeadAsync(
            saved.getId(),
            saved.getName(),
            saved.getPhone(),
            saved.getCompany(),
            saved.getService(),
            saved.getAssignedTo() != null ? saved.getAssignedTo().getName() : null
        );

        log.info("Lead created: id={}, name={}", saved.getId(), saved.getName());
        return toDTO(saved);
    }

    public LeadDTO update(String id, LeadDTO dto) {
        Lead lead = leadRepository.findByIdAndTenantIdAndDeletedFalse(id, tenantId())
            .orElseThrow(() -> new ResourceNotFoundException("Lead not found: " + id));
        ensureLeadVisible(lead);

        String normalizedEmail = normalizeEmail(dto.getEmail());
        if (normalizedEmail == null || normalizedEmail.isBlank()) {
            throw new IllegalStateException("Email is required");
        }
        String normalizedPhone = normalizePhone(dto.getPhone());
        if (!normalizedEmail.equalsIgnoreCase(lead.getEmail())) {
            leadRepository.findByEmailAndTenantIdAndDeletedFalse(normalizedEmail, tenantId())
                .ifPresent(existing -> {
                    throw new IllegalStateException("Lead with email already exists: " + normalizedEmail);
                });
        }
        if (normalizedPhone != null && !normalizedPhone.isBlank() && !normalizedPhone.equals(lead.getPhone())) {
            leadRepository.findByPhoneAndTenantIdAndDeletedFalse(normalizedPhone, tenantId())
                .ifPresent(existing -> {
                    throw new IllegalStateException("Lead with phone already exists: " + normalizedPhone);
                });
        }

        lead.setName(dto.getName());
        lead.setEmail(normalizedEmail);
        lead.setPhone(normalizedPhone);
        lead.setCompany(dto.getCompany());
        lead.setService(dto.getService());
        lead.setSpecialization(dto.getSpecialization());
        if (dto.getStatus() != null) lead.setStatus(dto.getStatus());
        if (dto.getScore() != null)  lead.setScore(dto.getScore());
        if (dto.getPriority() != null) lead.setPriority(dto.getPriority());
        if (dto.getDealValue() != null) lead.setDealValue(dto.getDealValue());
        if (dto.getAssignedToId() != null) {
            if (dto.getAssignedToId().isBlank()) {
                lead.setAssignedTo(null);
            } else {
                userRepository.findByIdAndTenantIdAndDeletedFalse(dto.getAssignedToId(), tenantId())
                    .ifPresent(lead::setAssignedTo);
            }
        }
        lead.setNotes(dto.getNotes());
        if (dto.getLastContactedAt() != null) {
            lead.setLastContactedAt(dto.getLastContactedAt());
        }
        if (dto.getConvertedAt() != null) {
            lead.setConvertedAt(dto.getConvertedAt());
        }
        if (dto.getLostReason() != null) {
            lead.setLostReason(dto.getLostReason());
        }
        if (dto.getFollowUpDate() != null) {
            lead.setFollowUpDate(dto.getFollowUpDate());
        }
        if (dto.getRevenueValue() != null) {
            lead.setRevenueValue(dto.getRevenueValue());
        }
        validateLostReason(lead);

        try {
            return toDTO(leadRepository.save(lead));
        } catch (DuplicateKeyException ex) {
            throw new IllegalStateException("Lead already exists with that email, phone, or external ID", ex);
        }
    }

    public void delete(String id) {
        Lead lead = leadRepository.findByIdAndTenantIdAndDeletedFalse(id, tenantId())
            .orElseThrow(() -> new ResourceNotFoundException("Lead not found: " + id));
        ensureLeadVisible(lead);
        lead.setDeleted(true);
        leadRepository.save(lead);
    }

    public int bulkDelete(List<String> ids) {
        if (ids == null || ids.isEmpty()) return 0;
        Long tenantId = tenantId();
        List<Lead> leads = ids.stream()
            .filter(id -> id != null && !id.isBlank())
            .map(id -> leadRepository.findByIdAndTenantIdAndDeletedFalse(id, tenantId))
            .flatMap(Optional::stream)
            .filter(this::canCurrentUserAccess)
            .toList();
        leads.forEach(l -> l.setDeleted(true));
        leadRepository.saveAll(leads);
        return leads.size();
    }

    @Transactional(readOnly = true)
    public List<LeadDTO> findDuplicates(String email, String phone, String excludeId) {
        String normalizedEmail = normalizeEmail(email);
        String normalizedPhone = normalizePhone(phone);
        if ((normalizedEmail == null || normalizedEmail.isBlank()) && (normalizedPhone == null || normalizedPhone.isBlank())) {
            return List.of();
        }

        return leadRepository.findByTenantIdAndDeletedFalse(tenantId()).stream()
            .filter(lead -> excludeId == null || excludeId.isBlank() || !excludeId.equals(lead.getId()))
            .filter(lead -> matchesDuplicateCandidate(lead, normalizedEmail, normalizedPhone))
            .map(this::toDTO)
            .toList();
    }

    public LeadDTO merge(String primaryId, String duplicateId) {
        if (primaryId == null || duplicateId == null || primaryId.isBlank() || duplicateId.isBlank()) {
            throw new IllegalStateException("Both lead ids are required");
        }
        if (primaryId.equals(duplicateId)) {
            throw new IllegalStateException("Cannot merge a lead into itself");
        }

        Lead primary = leadRepository.findByIdAndTenantIdAndDeletedFalse(primaryId, tenantId())
            .orElseThrow(() -> new ResourceNotFoundException("Lead not found: " + primaryId));
        Lead duplicate = leadRepository.findByIdAndTenantIdAndDeletedFalse(duplicateId, tenantId())
            .orElseThrow(() -> new ResourceNotFoundException("Lead not found: " + duplicateId));
        ensureLeadVisible(primary);
        ensureLeadVisible(duplicate);

        mergeLeadFields(primary, duplicate);
        primary.setNotes(appendNote(primary.getNotes(), "\n\n[Merged Lead]\nMerged duplicate lead: " + duplicate.getName() + " (" + duplicate.getId() + ")"));
        primary.setActivityLogs(mergeActivityLogs(primary.getActivityLogs(), duplicate.getActivityLogs()));

        duplicate.setDeleted(true);
        leadRepository.save(duplicate);
        Lead saved = leadRepository.save(primary);
        return toDTO(saved);
    }

    public LeadDTO reopen(String id, Map<String, Object> options) {
        Lead lead = leadRepository.findByIdAndTenantIdAndDeletedFalse(id, tenantId())
            .orElseThrow(() -> new ResourceNotFoundException("Lead not found: " + id));
        ensureLeadVisible(lead);

        lead.setStatus(Lead.LeadStatus.NEW);
        lead.setLostReason(null);
        lead.setConvertedAt(null);
        if (options != null) {
            String note = options.get("note") != null ? String.valueOf(options.get("note")).trim() : "";
            if (!note.isBlank()) {
                lead.setNotes(appendNote(lead.getNotes(), "\n\n[Reopened Lead]\n" + note));
            }
            String followUp = options.get("followUpDate") != null ? String.valueOf(options.get("followUpDate")).trim() : "";
            if (!followUp.isBlank()) {
                try {
                    lead.setFollowUpDate(LocalDateTime.parse(followUp));
                } catch (Exception ignored) {
                    // Keep current follow-up date if parsing fails.
                }
            }
        }

        return toDTO(leadRepository.save(lead));
    }

    @Transactional(readOnly = true)
    public Map<String, Object> leadAging(String id) {
        Lead lead = leadRepository.findByIdAndTenantIdAndDeletedFalse(id, tenantId())
            .orElseThrow(() -> new ResourceNotFoundException("Lead not found: " + id));
        ensureLeadVisible(lead);

        LocalDateTime reference = lead.getLastContactedAt() != null ? lead.getLastContactedAt() : lead.getCreatedAt();
        long ageMinutes = reference != null ? Duration.between(reference, LocalDateTime.now()).toMinutes() : 0;
        long untouchedMinutes = lead.getLastContactedAt() != null && lead.getCreatedAt() != null
            ? Duration.between(lead.getLastContactedAt(), LocalDateTime.now()).toMinutes()
            : ageMinutes;
        boolean stale = untouchedMinutes >= 60;
        boolean overdue = lead.getFollowUpDate() != null && lead.getFollowUpDate().isBefore(LocalDateTime.now());
        String slaState = overdue ? "BREACHED" : stale ? "AT_RISK" : "ON_TRACK";

        Map<String, Object> row = new LinkedHashMap<>();
        row.put("leadId", lead.getId());
        row.put("ageMinutes", ageMinutes);
        row.put("ageHours", Math.round((ageMinutes / 60.0) * 10.0) / 10.0);
        row.put("untouchedMinutes", untouchedMinutes);
        row.put("stale", stale);
        row.put("overdueFollowUp", overdue);
        row.put("slaState", slaState);
        row.put("createdAt", lead.getCreatedAt());
        row.put("lastContactedAt", lead.getLastContactedAt());
        row.put("followUpDate", lead.getFollowUpDate());
        row.put("assignedToId", lead.getAssignedTo() != null ? lead.getAssignedTo().getId() : null);
        row.put("assignedToName", lead.getAssignedTo() != null ? lead.getAssignedTo().getName() : null);
        return row;
    }

    @Transactional(readOnly = true)
    public List<String> assignmentHistory(String id) {
        Lead lead = leadRepository.findByIdAndTenantIdAndDeletedFalse(id, tenantId())
            .orElseThrow(() -> new ResourceNotFoundException("Lead not found: " + id));
        ensureLeadVisible(lead);
        return lead.getActivityLogs() != null ? lead.getActivityLogs() : List.of();
    }

    public Map<String, Object> importFromFile(MultipartFile file) {
        if (file == null || file.isEmpty()) {
            throw new IllegalStateException("Import file is empty.");
        }

        String fileName = file.getOriginalFilename() != null ? file.getOriginalFilename().toLowerCase(Locale.ROOT) : "";
        String contentType = file.getContentType() != null ? file.getContentType().toLowerCase(Locale.ROOT) : "";
        List<List<String>> rows;
        try {
            if (fileName.endsWith(".xlsx") || contentType.contains("spreadsheetml.sheet")) {
                rows = parseExcel(file);
            } else if (fileName.endsWith(".csv") || contentType.contains("csv") || contentType.contains("plain")) {
                String csv = new String(file.getBytes(), StandardCharsets.UTF_8);
                rows = parseCsv(csv);
            } else {
                throw new IllegalStateException("Unsupported import file type. Only CSV and XLSX are allowed.");
            }
        } catch (IOException e) {
            throw new IllegalStateException("Unable to read import file.", e);
        }

        if (rows.isEmpty()) {
            return Map.of("imported", 0, "skipped", 0, "errors", 0, "message", "No rows found in file.");
        }

        Map<String, Integer> headerIndex = buildHeaderIndex(rows.get(0));
        List<String> errorList = new ArrayList<>();
        int imported = 0;
        int skipped = 0;

        for (int i = 1; i < rows.size(); i++) {
            List<String> row = rows.get(i);
            String name = readCell(row, headerIndex, "name", "full name");
            String email = readCell(row, headerIndex, "email");
            String phone = readCell(row, headerIndex, "phone", "mobile", "mobile number");
            String company = readCell(row, headerIndex, "company");
            String service = readCell(row, headerIndex, "service");
            String specialization = readCell(row, headerIndex, "specialization", "subservice", "sub service", "sub_service");
            String source = readCell(row, headerIndex, "source");
            String score = readCell(row, headerIndex, "score");
            String status = readCell(row, headerIndex, "status");
            String value = readCell(row, headerIndex, "value", "deal value", "dealvalue");
            String tags = readCell(row, headerIndex, "tags");
            String notes = readCell(row, headerIndex, "notes", "remark", "remarks");

            if (email == null || email.isBlank()) {
                skipped++;
                errorList.add("Row " + (i + 1) + ": missing email");
                continue;
            }

            String normalizedEmail = email.trim().toLowerCase(Locale.ROOT);
            if (leadRepository.findByEmailAndTenantIdAndDeletedFalse(normalizedEmail, tenantId()).isPresent()) {
                skipped++;
                continue;
            }

            try {
                LeadDTO dto = LeadDTO.builder()
                    .name((name == null || name.isBlank()) ? normalizedEmail : name.trim())
                    .email(normalizedEmail)
                    .phone(phone)
                    .company(company)
                    .service(service)
                    .specialization(specialization)
                    .source(parseSource(source))
                    .score(parseScore(score))
                    .status(parseStatus(status))
                    .dealValue(parseAmount(value))
                    .tags(parseTags(tags))
                    .notes(notes != null && !notes.isBlank() ? notes : "Imported from file")
                    .build();
                create(dto);
                imported++;
            } catch (Exception ex) {
                skipped++;
                errorList.add("Row " + (i + 1) + ": " + ex.getMessage());
            }
        }

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("imported", imported);
        result.put("skipped", skipped);
        result.put("errors", errorList.size());
        if (!errorList.isEmpty()) {
            result.put("errorDetails", errorList.size() > 20 ? errorList.subList(0, 20) : errorList);
        }
        return result;
    }

    public Map<String, Object> syncFromPublicGoogleSheet(Map<String, String> config) {
        String sourceLabel = trim(config.get("sourceLabel"));
        if (sourceLabel == null || sourceLabel.isBlank()) sourceLabel = "Kriscel.com";
        String sheetName = trim(config.get("sheetName"));

        String csv = fetchPublicSheetCsv(config);

        List<List<String>> rows = parseCsv(csv);
        if (rows.isEmpty()) {
            return Map.of(
                "ok", true,
                "message", "No rows found in sheet.",
                "imported", 0,
                "skipped", 0,
                "errors", 0
            );
        }

        Map<String, Integer> headerIndex = buildHeaderIndex(rows.get(0));
        List<String> errorList = new ArrayList<>();
        int imported = 0;
        int skipped = 0;

        for (int i = 1; i < rows.size(); i++) {
            List<String> row = rows.get(i);
            String name = readCell(row, headerIndex, "name");
            String email = readCell(row, headerIndex, "email");
            String phone = readCell(row, headerIndex, "phone");
            String service = readCell(row, headerIndex, "service");
            String specialization = readCell(row, headerIndex, "specialization", "subservice", "sub service", "sub_service");
            String subject = readCell(row, headerIndex, "subject");
            String message = readCell(row, headerIndex, "message");
            String date = readCell(row, headerIndex, "date");

            if ((name == null || name.isBlank()) && (email == null || email.isBlank())) {
                skipped++;
                continue;
            }
            if (email == null || email.isBlank()) {
                skipped++;
                errorList.add("Row " + (i + 1) + ": missing email");
                continue;
            }

            String normalizedEmail = email.trim().toLowerCase(Locale.ROOT);
            if (leadRepository.findByEmailAndTenantIdAndDeletedFalse(normalizedEmail, tenantId()).isPresent()) {
                skipped++;
                continue;
            }

            String note = mergeNotes(subject, message, date);
            LeadDTO dto = LeadDTO.builder()
                .name(name != null && !name.isBlank() ? name.trim() : normalizedEmail)
                .email(normalizedEmail)
                .phone(phone)
                .service(service)
                .specialization(specialization)
                .source(Lead.LeadSource.WEBSITE)
                .status(Lead.LeadStatus.NEW)
                .utmSource("kriscel.com")
                .utmMedium("google_sheet_sync")
                .utmCampaign(sourceLabel)
                .notes(note)
                .build();

            try {
                create(dto);
                imported++;
            } catch (Exception ex) {
                skipped++;
                errorList.add("Row " + (i + 1) + ": " + ex.getMessage());
            }
        }

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("ok", true);
        result.put("message", "Google Sheet sync complete.");
        result.put("sheet", sheetName);
        result.put("imported", imported);
        result.put("skipped", skipped);
        result.put("errors", errorList.size());
        if (!errorList.isEmpty()) {
            result.put("errorDetails", errorList.size() > 20 ? errorList.subList(0, 20) : errorList);
        }
        return result;
    }

    @SuppressWarnings("unchecked")
    public Map<String, Object> syncFacebookLeadAds(Map<String, String> options) {
        Map<String, String> config = new LinkedHashMap<>(integrationService.getConfig("facebook"));
        if (options != null) {
            options.forEach((k, v) -> {
                if (k != null && v != null && !v.isBlank()) {
                    config.put(k, v.trim());
                }
            });
        }

        String pageId = trim(config.get("pageId"));
        if (pageId == null || pageId.isBlank()) {
            throw new IllegalStateException("Facebook pageId is missing. Set it in Integrations > Facebook.");
        }

        String accessToken = resolveFacebookLeadAccessTokenForPage(
            pageId,
            trim(config.get("accessToken"))
        );
        if (accessToken == null || accessToken.isBlank()) {
            throw new IllegalStateException("Facebook access token is missing. Set it in Integrations > Facebook or META_PAGE_ACCESS_TOKEN.");
        }

        String requestedFormId = trim(config.get("formId"));
        int formPageSize = parsePositiveInt(config.get("formPageSize"), 50);
        int leadPageSize = parsePositiveInt(config.get("leadPageSize"), 100);
        boolean includeArchived = parseBoolean(config.get("includeArchived"), true);

        int formsProcessed = 0;
        int leadsFetched = 0;
        int imported = 0;
        int merged = 0;
        int skipped = 0;
        List<String> errors = new ArrayList<>();

        String formsUrl = UriComponentsBuilder
            .fromHttpUrl("https://graph.facebook.com/{version}/{pageId}/leadgen_forms")
            .queryParam("fields", "id,name,status,created_time")
            .queryParam("limit", formPageSize)
            .queryParam("access_token", accessToken)
            .buildAndExpand(graphApiVersion, pageId)
            .toUriString();

        while (formsUrl != null && !formsUrl.isBlank()) {
            Map<String, Object> formsResponse;
            try {
                formsResponse = restTemplate.getForObject(formsUrl, Map.class);
            } catch (RestClientResponseException ex) {
                if (isFacebookPageAccessTokenRequiredError(ex)) {
                    throw new IllegalStateException(
                        "Facebook lead sync requires a Page Access Token for pageId=" + pageId
                            + ". Update Integrations > Facebook with that page token (not a user/app token), "
                            + "or provide META_PAGE_ACCESS_TOKEN.",
                        ex
                    );
                }
                throw new IllegalStateException("Failed to fetch Facebook lead forms: " + ex.getResponseBodyAsString(), ex);
            } catch (Exception ex) {
                throw new IllegalStateException("Failed to fetch Facebook lead forms: " + ex.getMessage(), ex);
            }

            List<Map<String, Object>> forms = formsResponse != null && formsResponse.get("data") instanceof List<?>
                ? (List<Map<String, Object>>) formsResponse.get("data")
                : List.of();

            for (Map<String, Object> form : forms) {
                String formId = trim(String.valueOf(form.get("id")));
                if (formId == null || formId.isBlank()) continue;

                if (requestedFormId != null && !requestedFormId.isBlank() && !requestedFormId.equals(formId)) {
                    continue;
                }

                String status = trim(String.valueOf(form.get("status")));
                if (!includeArchived && status != null && !status.isBlank() && !"ACTIVE".equalsIgnoreCase(status)) {
                    continue;
                }

                formsProcessed++;
                String formName = trim(String.valueOf(form.get("name")));
                Map<String, Object> perForm = syncFacebookFormLeads(formId, formName, accessToken, leadPageSize);
                leadsFetched += toInt(perForm.get("fetched"));
                imported += toInt(perForm.get("imported"));
                merged += toInt(perForm.get("merged"));
                skipped += toInt(perForm.get("skipped"));
                List<String> formErrors = (List<String>) perForm.get("errors");
                if (formErrors != null && !formErrors.isEmpty()) {
                    errors.addAll(formErrors);
                }
            }

            if (requestedFormId != null && !requestedFormId.isBlank() && formsProcessed > 0) {
                break;
            }
            formsUrl = extractPagingNext(formsResponse);
        }

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("ok", true);
        result.put("message", "Facebook lead sync completed.");
        result.put("pageId", pageId);
        result.put("formId", requestedFormId != null ? requestedFormId : "");
        result.put("formsProcessed", formsProcessed);
        result.put("fetched", leadsFetched);
        result.put("imported", imported);
        result.put("merged", merged);
        result.put("skipped", skipped);
        result.put("errors", errors.size());
        if (!errors.isEmpty()) {
            result.put("errorDetails", errors.size() > 50 ? errors.subList(0, 50) : errors);
        }
        return result;
    }

    public Map<String, Object> testPublicGoogleSheetAccess(Map<String, String> config) {
        String csv = fetchPublicSheetCsv(config);
        List<List<String>> rows = parseCsv(csv);
        if (rows.isEmpty()) {
            throw new IllegalStateException("Sheet is reachable but empty.");
        }

        List<String> headers = rows.get(0);
        Map<String, Integer> headerIndex = buildHeaderIndex(headers);
        boolean hasName = headerIndex.containsKey("name");
        boolean hasEmail = headerIndex.containsKey("email");
        if (!hasName && !hasEmail) {
            throw new IllegalStateException("Header row must include at least Name or Email columns.");
        }

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("ok", true);
        result.put("message", "Sheet access test passed.");
        result.put("rowsDetected", Math.max(0, rows.size() - 1));
        result.put("headers", headers);
        return result;
    }

    public byte[] export(String format, String status) {
        List<Lead> leads;
        if (status != null && !status.isBlank()) {
            leads = leadRepository.findByTenantIdAndDeletedFalseAndStatus(
                tenantId(),
                Lead.LeadStatus.valueOf(status.toUpperCase(Locale.ROOT))
            );
        } else {
            leads = leadRepository.findByTenantIdAndDeletedFalse(tenantId());
        }

        String normalized = format == null ? "csv" : format.trim().toLowerCase(Locale.ROOT);
        if ("xlsx".equals(normalized)) return exportAsXlsx(leads);
        return exportAsCsv(leads);
    }

    public Map<String, Object> scoreWithAI(String id) {
        Lead lead = leadRepository.findByIdAndTenantIdAndDeletedFalse(id, tenantId())
            .orElseThrow(() -> new ResourceNotFoundException("Lead not found: " + id));
        ensureLeadVisible(lead);

        int scoreValue = calculateLeadScoreValue(lead);
        Lead.LeadScore score = mapScore(scoreValue);
        String nextAction = suggestNextAction(lead, score, scoreValue);

        lead.setAiScoreValue(scoreValue);
        lead.setScore(score);
        lead.setAiNextAction(nextAction);
        leadRepository.save(lead);

        return Map.of(
            "leadId", id,
            "score", score.name(),
            "scoreValue", scoreValue,
            "nextAction", nextAction,
            "message", "Lead scored successfully"
        );
    }

    public Map<String, Object> convertToCustomer(String id, Map<String, Object> options) {
        Lead lead = leadRepository.findByIdAndTenantIdAndDeletedFalse(id, tenantId())
            .orElseThrow(() -> new ResourceNotFoundException("Lead not found: " + id));
        ensureLeadVisible(lead);

        Customer customer = customerRepository
            .findByEmailAndTenantIdAndDeletedFalse(lead.getEmail(), tenantId())
            .orElseGet(() -> {
                Customer.CustomerBuilder builder = Customer.builder()
                    .name(lead.getName())
                    .email(lead.getEmail())
                    .phone(lead.getPhone())
                    .company(lead.getCompany())
                    .website(lead.getWebsite())
                    .industry(lead.getService())
                    .primaryContact(lead.getName())
                    .status(Customer.CustomerStatus.ACTIVE)
                    .notes(lead.getNotes());

                if (lead.getAssignedTo() != null) {
                    builder.accountManager(lead.getAssignedTo());
                }

                Customer created = builder.build();
                created.setTenantId(tenantId());
                return customerRepository.save(created);
            });

        Deal deal = dealRepository
            .findByLead_IdAndTenantIdAndDeletedFalse(lead.getId(), tenantId())
            .orElseGet(() -> {
                String title = (lead.getCompany() != null && !lead.getCompany().isBlank())
                    ? lead.getCompany() + " Opportunity"
                    : lead.getName() + " Opportunity";

                Deal.DealBuilder builder = Deal.builder()
                    .title(title)
                    .description("Auto-created from converted lead")
                    .stage(Deal.DealStage.WON)
                    .priority(Deal.DealPriority.MEDIUM)
                    .dealValue(lead.getDealValue())
                    .pipelineId(1L)
                    .lead(lead)
                    .notes(lead.getNotes());

                if (lead.getAssignedTo() != null) {
                    builder.owner(lead.getAssignedTo());
                }

                Deal created = builder.build();
                created.setTenantId(tenantId());
                return dealRepository.save(created);
            });

        LocalDateTime convertedAt = LocalDateTime.now();
        lead.setStatus(Lead.LeadStatus.WON);
        lead.setConvertedAt(convertedAt);
        lead.setLastContactedAt(LocalDateTime.now());
        if (lead.getRevenueValue() == null) {
            lead.setRevenueValue(lead.getDealValue());
        }
        leadRepository.save(lead);

        try {
            notificationService.notifyActiveUsers(
                tenantId(),
                com.nexacrm.model.Notification.NotificationType.DEAL,
                "Lead Converted",
                "Lead " + (lead.getName() != null ? lead.getName() : "Unknown lead") +
                    " converted into deal " + deal.getTitle(),
                "/pipeline",
                "deal",
                deal.getId(),
                null
            );
        } catch (Exception ex) {
            log.warn("Failed to publish lead conversion notification for lead {}: {}", lead.getId(), ex.getMessage());
        }

        return Map.of(
            "message", "Lead converted to customer",
            "leadId", lead.getId(),
            "customerId", customer.getId(),
            "dealId", deal.getId(),
            "convertedAt", convertedAt
        );
    }

    public Map<String, Object> callLeadNow(String id, String script) {
        Lead lead = leadRepository.findByIdAndTenantIdAndDeletedFalse(id, tenantId())
            .orElseThrow(() -> new ResourceNotFoundException("Lead not found: " + id));
        ensureLeadVisible(lead);

        String phone = lead.getPhone() == null ? "" : lead.getPhone().trim();
        if (phone.isBlank()) {
            throw new IllegalStateException("Lead phone number is missing.");
        }

        String callScript = script == null ? "" : script.trim();
        if (callScript.isBlank()) {
            String leadName = lead.getName() == null ? "" : lead.getName().trim();
            String service = lead.getService() == null ? "" : lead.getService().trim();
            String serviceSnippet = service.isBlank() ? "" : " for " + service;
            callScript = "Hi " + (leadName.isBlank() ? "there" : leadName)
                + ", this is NexaCRM calling regarding your enquiry"
                + serviceSnippet
                + ". Is this a good time to talk?";
        }

        communicationService.sendLeadVoiceCall(
            lead.getId(),
            lead.getName(),
            phone,
            callScript,
            "manual_lead_call",
            Map.of(
                "leadId", lead.getId(),
                "leadName", lead.getName() != null ? lead.getName() : "",
                "source", lead.getSource() != null ? lead.getSource().name() : "OTHER"
            )
        );
        lead.setLastContactedAt(LocalDateTime.now());
        leadRepository.save(lead);

        return Map.of(
            "message", "Call queued successfully",
            "leadId", lead.getId(),
            "phone", phone
        );
    }

    // ── Facebook Lead Ads ─────────────────────────────────────────

    @Async
    public void processFacebookLeadsWebhookAsync(String rawBody) {
        try {
            Map<String, Object> payload = objectMapper.readValue(rawBody, Map.class);
            List<Map<String, Object>> entries = (List<Map<String, Object>>) payload.get("entry");
            if (entries == null) return;

            for (Map<String, Object> entry : entries) {
                List<Map<String, Object>> changes = (List<Map<String, Object>>) entry.get("changes");
                if (changes == null) continue;
                for (Map<String, Object> change : changes) {
                    if (!"leadgen".equals(change.get("field"))) continue;
                    Map<String, Object> value = (Map<String, Object>) change.get("value");
                    if (value == null) continue;
                    String leadgenId = String.valueOf(value.get("leadgen_id"));
                    String adId     = value.get("ad_id")   != null ? String.valueOf(value.get("ad_id"))   : null;
                    String formId   = value.get("form_id") != null ? String.valueOf(value.get("form_id")) : null;
                    fetchAndSaveLead(leadgenId, adId, formId);
                }
            }
        } catch (Exception e) {
            log.error("Error processing Facebook Lead Ads webhook", e);
        }
    }

    @SuppressWarnings("unchecked")
    private void fetchAndSaveLead(String leadgenId, String adId, String formId) {
        try {
            // Idempotency: skip if we already processed this Facebook lead
            if (leadRepository.findByFacebookLeadIdAndTenantIdAndDeletedFalse(leadgenId, tenantId()).isPresent()) {
                log.info("Facebook lead already exists, skipping: leadgen_id={}", leadgenId);
                return;
            }

            String accessToken = resolveFacebookLeadAccessToken();
            if (accessToken.isBlank()) {
                log.error("Facebook lead fetch failed: missing access token (integration + env both empty)");
                return;
            }

            String url = UriComponentsBuilder
                .fromHttpUrl("https://graph.facebook.com/{version}/{id}")
                .queryParam("access_token", accessToken)
                .queryParam("fields", "field_data,created_time,ad_id,form_id,campaign_id")
                .buildAndExpand(graphApiVersion, leadgenId)
                .toUriString();

            Map<String, Object> response = restTemplate.getForObject(url, Map.class);
            if (response == null) {
                log.warn("Facebook Graph API returned null for leadgen_id={}", leadgenId);
                return;
            }

            // Prefer IDs from the Graph API response over the webhook payload (more authoritative)
            String resolvedFormId = response.get("form_id") != null
                ? String.valueOf(response.get("form_id")) : formId;
            String resolvedAdId   = response.get("ad_id") != null
                ? String.valueOf(response.get("ad_id"))   : adId;

            List<Map<String, Object>> fieldData = (List<Map<String, Object>>) response.get("field_data");
            String name        = extractFieldValue(fieldData, "full_name", "first_name");
            String email       = extractFieldValue(fieldData, "email");
            String phone       = extractFieldValue(fieldData, "phone_number", "phone");
            String company     = extractFieldValue(fieldData, "company_name", "company");
            String designation = extractFieldValue(fieldData, "job_title", "work_job_title");

            if (name == null || name.isBlank()) name = "Facebook Lead " + leadgenId;
            if (email == null || email.isBlank()) email = leadgenId + "@facebook-lead.local";

            LeadDTO dto = LeadDTO.builder()
                .name(name)
                .email(email)
                .phone(phone)
                .company(company)
                .designation(designation)
                .source(Lead.LeadSource.META_ADS)
                .status(Lead.LeadStatus.NEW)
                .score(Lead.LeadScore.COLD)
                .priority(Lead.LeadPriority.MEDIUM)
                .utmSource("facebook")
                .utmMedium("lead_ad")
                .utmCampaign(resolvedAdId)
                .facebookLeadId(leadgenId)
                .facebookFormId(resolvedFormId)
                .facebookAdId(resolvedAdId)
                .notes(buildFacebookWebhookNotes(resolvedFormId, resolvedAdId, response))
                .build();

            create(dto);
            log.info("Facebook lead saved: leadgen_id={}, name={}, email={}", leadgenId, name, email);
        } catch (Exception e) {
            log.error("Failed to fetch/save Facebook lead for leadgen_id={}", leadgenId, e);
        }
    }

    private String resolveFacebookLeadAccessToken() {
        String integrationToken = trim(integrationService.getConfig("facebook").get("accessToken"));
        if (integrationToken != null && !integrationToken.isBlank()) {
            return integrationToken;
        }
        return trim(pageAccessToken);
    }

    @SuppressWarnings("unchecked")
    private String resolveFacebookLeadAccessTokenForPage(String pageId, String configuredToken) {
        String token = trim(configuredToken);
        if (token == null || token.isBlank()) {
            token = resolveFacebookLeadAccessToken();
        }
        if (token == null || token.isBlank()) {
            return token;
        }

        String discoveredPageToken = null;
        try {
            String meAccountsUrl = UriComponentsBuilder
                .fromHttpUrl("https://graph.facebook.com/{version}/me/accounts")
                .queryParam("fields", "id,access_token")
                .queryParam("limit", 200)
                .queryParam("access_token", token)
                .buildAndExpand(graphApiVersion)
                .toUriString();

            Map<String, Object> meAccounts = restTemplate.getForObject(meAccountsUrl, Map.class);
            List<Map<String, Object>> pages = meAccounts != null && meAccounts.get("data") instanceof List<?>
                ? (List<Map<String, Object>>) meAccounts.get("data")
                : List.of();

            for (Map<String, Object> page : pages) {
                String id = trim(String.valueOf(page.get("id")));
                if (pageId != null && pageId.equals(id)) {
                    discoveredPageToken = trim(String.valueOf(page.get("access_token")));
                    break;
                }
            }
        } catch (Exception ex) {
            log.debug("Facebook token discovery via /me/accounts skipped: {}", ex.getMessage());
        }

        if (discoveredPageToken != null && !discoveredPageToken.isBlank()) {
            if (!discoveredPageToken.equals(token)) {
                log.info("Resolved Facebook Page Access Token from /me/accounts for pageId={}", pageId);
            }
            return discoveredPageToken;
        }
        return token;
    }

    private boolean isFacebookPageAccessTokenRequiredError(RestClientResponseException ex) {
        String body = ex.getResponseBodyAsString();
        String normalized = body == null ? "" : body.toLowerCase(Locale.ROOT);
        return normalized.contains("code\":190")
            && normalized.contains("must be called with a page access token");
    }

    @SuppressWarnings("unchecked")
    private Map<String, Object> syncFacebookFormLeads(String formId, String formName, String accessToken, int leadPageSize) {
        int fetched = 0;
        int imported = 0;
        int merged = 0;
        int skipped = 0;
        List<String> errors = new ArrayList<>();

        String leadsUrl = UriComponentsBuilder
            .fromHttpUrl("https://graph.facebook.com/{version}/{formId}/leads")
            .queryParam("fields", "id,created_time,ad_id,form_id,campaign_name,field_data")
            .queryParam("limit", leadPageSize)
            .queryParam("access_token", accessToken)
            .buildAndExpand(graphApiVersion, formId)
            .toUriString();

        while (leadsUrl != null && !leadsUrl.isBlank()) {
            Map<String, Object> leadsResponse;
            try {
                leadsResponse = restTemplate.getForObject(leadsUrl, Map.class);
            } catch (Exception ex) {
                errors.add("Form " + formId + ": fetch failed - " + ex.getMessage());
                break;
            }

            List<Map<String, Object>> leads = leadsResponse != null && leadsResponse.get("data") instanceof List<?>
                ? (List<Map<String, Object>>) leadsResponse.get("data")
                : List.of();

            for (Map<String, Object> rawLead : leads) {
                fetched++;
                String leadgenId = trim(String.valueOf(rawLead.get("id")));
                if (leadgenId == null || leadgenId.isBlank()) {
                    skipped++;
                    continue;
                }
                if (leadRepository.findByFacebookLeadIdAndTenantIdAndDeletedFalse(leadgenId, tenantId()).isPresent()) {
                    skipped++;
                    continue;
                }

                try {
                    List<Map<String, Object>> fieldData = rawLead.get("field_data") instanceof List<?>
                        ? (List<Map<String, Object>>) rawLead.get("field_data")
                        : List.of();

                    String name = extractFieldValue(fieldData, "full_name", "first_name");
                    String email = extractFieldValue(fieldData, "email");
                    String phone = extractFieldValue(fieldData, "phone_number", "phone");
                    String company = extractFieldValue(fieldData, "company_name", "company");
                    String designation = extractFieldValue(fieldData, "job_title", "work_job_title");
                    String service = extractFieldValue(fieldData, "service", "service_name");
                    String specialization = extractFieldValue(fieldData, "specialization", "subservice", "sub_service");
                    String campaignName = trim(String.valueOf(rawLead.get("campaign_name")));
                    String adId = trim(String.valueOf(rawLead.get("ad_id")));
                    String responseFormId = trim(String.valueOf(rawLead.get("form_id")));

                    if (name == null || name.isBlank()) {
                        name = "Facebook Lead " + leadgenId;
                    }
                    if (email == null || email.isBlank()) {
                        email = leadgenId + "@facebook-lead.local";
                    }

                    Map<String, Object> enrichedPayload = new HashMap<>(rawLead);
                    enrichedPayload.putIfAbsent("form_name", formName);

                    LeadDTO dto = LeadDTO.builder()
                        .name(name)
                        .email(email)
                        .phone(phone)
                        .company(company)
                        .designation(designation)
                        .service(service)
                        .specialization(specialization)
                        .source(Lead.LeadSource.META_ADS)
                        .status(Lead.LeadStatus.NEW)
                        .score(Lead.LeadScore.COLD)
                        .priority(Lead.LeadPriority.MEDIUM)
                        .utmSource("facebook")
                        .utmMedium("lead_ads_sync")
                        .utmCampaign(campaignName != null && !campaignName.isBlank() ? campaignName : adId)
                        .facebookLeadId(leadgenId)
                        .facebookFormId(responseFormId != null && !responseFormId.isBlank() ? responseFormId : formId)
                        .facebookAdId(adId)
                        .notes(buildFacebookWebhookNotes(
                            responseFormId != null && !responseFormId.isBlank() ? responseFormId : formId,
                            adId,
                            enrichedPayload
                        ))
                        .build();

                    create(dto);
                    imported++;
                } catch (Exception ex) {
                    if (isDuplicateEmailError(ex)) {
                        if (mergeIntoExistingLeadByEmail(rawLead, formId, formName)) {
                            merged++;
                        } else {
                            skipped++;
                        }
                        continue;
                    }
                    errors.add("Lead " + leadgenId + ": " + ex.getMessage());
                }
            }

            leadsUrl = extractPagingNext(leadsResponse);
        }

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("fetched", fetched);
        result.put("imported", imported);
        result.put("merged", merged);
        result.put("skipped", skipped);
        result.put("errors", errors);
        return result;
    }

    private String buildFacebookWebhookNotes(String formId, String adId, Map<String, Object> graphResponse) {
        StringBuilder sb = new StringBuilder("Facebook Lead Ad | Form: ");
        sb.append(formId);
        if (adId != null && !adId.isBlank()) {
            sb.append(" | Ad: ").append(adId);
        }
        sb.append("\n\nRaw Payload:\n");
        try {
            sb.append(objectMapper.writerWithDefaultPrettyPrinter().writeValueAsString(graphResponse));
        } catch (Exception e) {
            sb.append(String.valueOf(graphResponse));
        }
        return sb.toString();
    }

    @SuppressWarnings("unchecked")
    private boolean mergeIntoExistingLeadByEmail(Map<String, Object> rawLead, String fallbackFormId, String fallbackFormName) {
        try {
            List<Map<String, Object>> fieldData = rawLead.get("field_data") instanceof List<?>
                ? (List<Map<String, Object>>) rawLead.get("field_data")
                : List.of();
            String email = extractFieldValue(fieldData, "email");
            if (email == null || email.isBlank()) return false;

            String normalizedEmail = email.trim().toLowerCase(Locale.ROOT);
            Optional<Lead> existingOpt = leadRepository.findByEmailAndTenantIdAndDeletedFalse(normalizedEmail, tenantId());
            if (existingOpt.isEmpty()) return false;

            Lead existing = existingOpt.get();
            String leadgenId = trim(String.valueOf(rawLead.get("id")));
            String adId = trim(String.valueOf(rawLead.get("ad_id")));
            String responseFormId = trim(String.valueOf(rawLead.get("form_id")));
            String formId = responseFormId != null && !responseFormId.isBlank() ? responseFormId : fallbackFormId;

            Map<String, Object> enrichedPayload = new HashMap<>(rawLead);
            enrichedPayload.putIfAbsent("form_name", fallbackFormName);

            String mergeNote = "\n\n[Meta Sync Merge]\n"
                + buildFacebookWebhookNotes(formId, adId, enrichedPayload);
            existing.setNotes(appendNote(existing.getNotes(), mergeNote));
            if (existing.getFacebookLeadId() == null || existing.getFacebookLeadId().isBlank()) {
                existing.setFacebookLeadId(leadgenId);
            }
            if (existing.getFacebookFormId() == null || existing.getFacebookFormId().isBlank()) {
                existing.setFacebookFormId(formId);
            }
            if (existing.getFacebookAdId() == null || existing.getFacebookAdId().isBlank()) {
                existing.setFacebookAdId(adId);
            }
            if (existing.getSource() == null || existing.getSource() == Lead.LeadSource.OTHER) {
                existing.setSource(Lead.LeadSource.META_ADS);
            }
            leadRepository.save(existing);
            return true;
        } catch (Exception ignored) {
            return false;
        }
    }

    private boolean isDuplicateEmailError(Exception ex) {
        String message = ex.getMessage();
        return message != null && message.toLowerCase(Locale.ROOT).contains("already exists");
    }

    private String appendNote(String existing, String addition) {
        String base = existing == null ? "" : existing.trim();
        String extra = addition == null ? "" : addition.trim();
        if (extra.isBlank()) return base;
        if (base.isBlank()) return extra;
        return base + "\n" + extra;
    }

    private void validateLostReason(Lead lead) {
        if (lead == null || lead.getStatus() != Lead.LeadStatus.LOST) {
            return;
        }
        if (lead.getLostReason() == null || lead.getLostReason().isBlank()) {
            throw new IllegalStateException("Lost reason is required when lead status is LOST");
        }
    }

    private boolean matchesDuplicateCandidate(Lead lead, String normalizedEmail, String normalizedPhone) {
        if (lead == null) return false;
        String leadEmail = normalizeEmail(lead.getEmail());
        String leadPhone = normalizePhone(lead.getPhone());
        boolean emailMatch = normalizedEmail != null && !normalizedEmail.isBlank() && normalizedEmail.equals(leadEmail);
        boolean phoneMatch = normalizedPhone != null && !normalizedPhone.isBlank() && normalizedPhone.equals(leadPhone);
        return emailMatch || phoneMatch;
    }

    private void mergeLeadFields(Lead primary, Lead duplicate) {
        if (primary == null || duplicate == null) return;
        if (isBlank(primary.getCompany())) primary.setCompany(duplicate.getCompany());
        if (isBlank(primary.getWebsite())) primary.setWebsite(duplicate.getWebsite());
        if (isBlank(primary.getDesignation())) primary.setDesignation(duplicate.getDesignation());
        if (isBlank(primary.getService())) primary.setService(duplicate.getService());
        if (isBlank(primary.getSpecialization())) primary.setSpecialization(duplicate.getSpecialization());
        if ((primary.getSource() == null || primary.getSource() == Lead.LeadSource.OTHER) && duplicate.getSource() != null) primary.setSource(duplicate.getSource());
        if ((primary.getStatus() == null || primary.getStatus() == Lead.LeadStatus.NEW) && duplicate.getStatus() != null) primary.setStatus(duplicate.getStatus());
        if ((primary.getScore() == null || primary.getScore() == Lead.LeadScore.COLD) && duplicate.getScore() != null) primary.setScore(duplicate.getScore());
        if (primary.getPriority() == null && duplicate.getPriority() != null) primary.setPriority(duplicate.getPriority());
        if (primary.getDealValue() == null && duplicate.getDealValue() != null) primary.setDealValue(duplicate.getDealValue());
        if (primary.getUtmSource() == null) primary.setUtmSource(duplicate.getUtmSource());
        if (primary.getUtmMedium() == null) primary.setUtmMedium(duplicate.getUtmMedium());
        if (primary.getUtmCampaign() == null) primary.setUtmCampaign(duplicate.getUtmCampaign());
        if (primary.getAiScoreValue() == null) primary.setAiScoreValue(duplicate.getAiScoreValue());
        if (isBlank(primary.getAiNextAction())) primary.setAiNextAction(duplicate.getAiNextAction());
        if (isBlank(primary.getNotes())) primary.setNotes(duplicate.getNotes());
        if (primary.getLastContactedAt() == null) primary.setLastContactedAt(duplicate.getLastContactedAt());
        if (primary.getConvertedAt() == null) primary.setConvertedAt(duplicate.getConvertedAt());
        if (isBlank(primary.getLostReason())) primary.setLostReason(duplicate.getLostReason());
        if (primary.getFollowUpDate() == null) primary.setFollowUpDate(duplicate.getFollowUpDate());
        if (primary.getRevenueValue() == null) primary.setRevenueValue(duplicate.getRevenueValue());
        if (isBlank(primary.getFacebookLeadId())) primary.setFacebookLeadId(duplicate.getFacebookLeadId());
        if (isBlank(primary.getFacebookFormId())) primary.setFacebookFormId(duplicate.getFacebookFormId());
        if (isBlank(primary.getFacebookAdId())) primary.setFacebookAdId(duplicate.getFacebookAdId());
        if (primary.getAssignedTo() == null) primary.setAssignedTo(duplicate.getAssignedTo());
    }

    private List<String> mergeActivityLogs(List<String> primaryLogs, List<String> duplicateLogs) {
        List<String> merged = new ArrayList<>();
        if (duplicateLogs != null) merged.addAll(duplicateLogs);
        if (primaryLogs != null) merged.addAll(primaryLogs);
        return merged.stream().distinct().limit(25).collect(Collectors.toList());
    }

    private boolean isBlank(String value) {
        return value == null || value.isBlank();
    }

    @SuppressWarnings("unchecked")
    private String extractPagingNext(Map<String, Object> response) {
        if (response == null) return null;
        Object pagingObj = response.get("paging");
        if (!(pagingObj instanceof Map<?, ?> paging)) return null;
        Object next = ((Map<String, Object>) paging).get("next");
        return next == null ? null : String.valueOf(next);
    }

    private int parsePositiveInt(String value, int defaultValue) {
        try {
            int parsed = Integer.parseInt(trim(value));
            return parsed > 0 ? parsed : defaultValue;
        } catch (Exception e) {
            return defaultValue;
        }
    }

    private boolean parseBoolean(String value, boolean defaultValue) {
        String v = trim(value);
        if (v == null || v.isBlank()) return defaultValue;
        return "true".equalsIgnoreCase(v) || "1".equals(v) || "yes".equalsIgnoreCase(v);
    }

    private int toInt(Object value) {
        if (value instanceof Number n) return n.intValue();
        try {
            return Integer.parseInt(String.valueOf(value));
        } catch (Exception e) {
            return 0;
        }
    }

    @SuppressWarnings("unchecked")
    private String extractFieldValue(List<Map<String, Object>> fieldData, String... fieldNames) {
        if (fieldData == null) return null;
        for (String fieldName : fieldNames) {
            String value = fieldData.stream()
                .filter(f -> fieldName.equals(f.get("name")))
                .findFirst()
                .map(f -> {
                    List<String> values = (List<String>) f.get("values");
                    return (values != null && !values.isEmpty()) ? values.get(0) : null;
                })
                .orElse(null);
            if (value != null && !value.isBlank()) return value;
        }
        return null;
    }

    private Map<String, Integer> buildHeaderIndex(List<String> headers) {
        Map<String, Integer> index = new LinkedHashMap<>();
        for (int i = 0; i < headers.size(); i++) {
            String key = normalizeKey(headers.get(i));
            if (!key.isBlank()) {
                index.putIfAbsent(key, i);
            }
        }
        return index;
    }

    private String readCell(List<String> row, Map<String, Integer> headerIndex, String... keys) {
        for (String key : keys) {
            Integer idx = headerIndex.get(normalizeKey(key));
            if (idx == null || idx < 0 || idx >= row.size()) continue;
            String value = trim(row.get(idx));
            if (value != null && !value.isBlank()) return value;
        }
        return "";
    }

    private String normalizeKey(String value) {
        return value == null ? "" : value.trim().toLowerCase(Locale.ROOT).replace(" ", "");
    }

    private String trim(String value) {
        if (value == null) return null;
        String trimmed = value.trim();
        return trimmed.isEmpty() ? "" : trimmed;
    }

    private String mergeNotes(String subject, String message, String date) {
        StringBuilder sb = new StringBuilder("Imported from Google Sheet");
        if (subject != null && !subject.isBlank()) sb.append(" | Subject: ").append(subject.trim());
        if (message != null && !message.isBlank()) sb.append(" | Message: ").append(message.trim());
        if (date != null && !date.isBlank()) sb.append(" | Date: ").append(date.trim());
        return sb.toString();
    }

    private List<String> parseTags(String tags) {
        if (tags == null || tags.isBlank()) return null;
        List<String> values = Arrays.stream(tags.split(","))
            .map(String::trim)
            .filter(s -> !s.isBlank())
            .toList();
        return values.isEmpty() ? null : values;
    }

    private BigDecimal parseAmount(String raw) {
        if (raw == null || raw.isBlank()) return null;
        String normalized = raw.replace(",", "").replace("₹", "").trim();
        if (normalized.isBlank()) return null;
        return new BigDecimal(normalized);
    }

    private Lead.LeadSource parseSource(String source) {
        if (source == null || source.isBlank()) return Lead.LeadSource.OTHER;
        String s = source.trim().toUpperCase(Locale.ROOT).replace(" ", "_");
        if ("GOOGLEADS".equals(s)) s = "GOOGLE_ADS";
        if ("METAADS".equals(s)) s = "META_ADS";
        try {
            return Lead.LeadSource.valueOf(s);
        } catch (IllegalArgumentException ex) {
            return Lead.LeadSource.OTHER;
        }
    }

    private Lead.LeadScore parseScore(String score) {
        if (score == null || score.isBlank()) return Lead.LeadScore.COLD;
        try {
            return Lead.LeadScore.valueOf(score.trim().toUpperCase(Locale.ROOT));
        } catch (IllegalArgumentException ex) {
            return Lead.LeadScore.COLD;
        }
    }

    private Lead.LeadStatus parseStatus(String status) {
        if (status == null || status.isBlank()) return Lead.LeadStatus.NEW;
        try {
            return Lead.LeadStatus.valueOf(status.trim().toUpperCase(Locale.ROOT));
        } catch (IllegalArgumentException ex) {
            return Lead.LeadStatus.NEW;
        }
    }

    private String normalizeEmail(String email) {
        if (email == null) return null;
        String normalized = email.trim().toLowerCase(Locale.ROOT);
        return normalized.isBlank() ? null : normalized;
    }

    private String normalizePhone(String phone) {
        if (phone == null) return null;
        String normalized = phone.trim();
        return normalized.isBlank() ? null : normalized;
    }

    private void ensureLeadVisible(Lead lead) {
        if (!canCurrentUserAccess(lead)) {
            throw new ResourceNotFoundException("Lead not found: " + lead.getId());
        }
    }

    private boolean canCurrentUserAccess(Lead lead) {
        User current = currentUser();
        if (current == null || User.isAdminLike(current.getRole()) || current.getRole() == User.Role.MANAGER) {
            return true;
        }
        if (current.getId() == null || current.getId().isBlank() || lead == null) {
            return false;
        }
        return lead.getAssignedTo() != null && current.getId().equals(lead.getAssignedTo().getId());
    }

    private int calculateLeadScoreValue(Lead lead) {
        int scoreValue = 10;

        if (lead.getEmail() != null && !lead.getEmail().isBlank()) scoreValue += 12;
        if (lead.getPhone() != null && !lead.getPhone().isBlank()) scoreValue += 10;
        if (lead.getCompany() != null && !lead.getCompany().isBlank()) scoreValue += 8;
        if (lead.getAssignedTo() != null) scoreValue += 6;

        if (lead.getSource() != null) {
            scoreValue += switch (lead.getSource()) {
                case REFERRAL -> 20;
                case LINKEDIN -> 15;
                case WEBSITE -> 12;
                case EMAIL -> 10;
                case GOOGLE_ADS, META_ADS -> 8;
                case WHATSAPP, FACEBOOK, INSTAGRAM -> 7;
                default -> 5;
            };
        }

        if (lead.getStatus() != null) {
            scoreValue += switch (lead.getStatus()) {
                case NEW -> 0;
                case CONTACTED -> 8;
                case QUALIFIED -> 18;
                case PROPOSAL -> 22;
                case NEGOTIATION -> 26;
                case WON -> 30;
                case LOST -> -25;
            };
        }

        if (lead.getPriority() != null) {
            scoreValue += switch (lead.getPriority()) {
                case HIGH -> 12;
                case MEDIUM -> 4;
                case LOW -> -4;
            };
        }

        if (lead.getDealValue() != null) {
            int valueBand = lead.getDealValue().compareTo(BigDecimal.valueOf(1_000_000)) >= 0 ? 20
                : lead.getDealValue().compareTo(BigDecimal.valueOf(300_000)) >= 0 ? 14
                : lead.getDealValue().compareTo(BigDecimal.valueOf(100_000)) >= 0 ? 8 : 3;
            scoreValue += valueBand;
        }

        if (lead.getLastContactedAt() != null) {
            long daysSinceContact = Math.max(0, Duration.between(lead.getLastContactedAt(), LocalDateTime.now()).toDays());
            if (daysSinceContact <= 2) scoreValue += 10;
            else if (daysSinceContact <= 7) scoreValue += 4;
            else if (daysSinceContact > 14) scoreValue -= 10;
        }

        return Math.max(0, Math.min(100, scoreValue));
    }

    private Lead.LeadScore mapScore(int scoreValue) {
        if (scoreValue >= 75) return Lead.LeadScore.HOT;
        if (scoreValue >= 45) return Lead.LeadScore.WARM;
        return Lead.LeadScore.COLD;
    }

    private String suggestNextAction(Lead lead, Lead.LeadScore score, int scoreValue) {
        if (lead.getStatus() == Lead.LeadStatus.LOST) {
            return "Review loss reason and schedule a re-engagement plan in 30 days.";
        }
        if (score == Lead.LeadScore.HOT) {
            return "Schedule a decision-maker call within 24 hours and push to negotiation.";
        }
        if (score == Lead.LeadScore.WARM) {
            return "Follow up with a personalized proposal and timeline this week.";
        }
        if (scoreValue < 30) {
            return "Run a discovery call to validate budget, authority, and timeline.";
        }
        return "Continue qualification and capture missing requirements.";
    }

    private List<List<String>> parseCsv(String csv) {
        List<List<String>> rows = new ArrayList<>();
        List<String> currentRow = new ArrayList<>();
        StringBuilder cell = new StringBuilder();
        boolean inQuotes = false;

        for (int i = 0; i < csv.length(); i++) {
            char ch = csv.charAt(i);

            if (ch == '"') {
                if (inQuotes && i + 1 < csv.length() && csv.charAt(i + 1) == '"') {
                    cell.append('"');
                    i++;
                } else {
                    inQuotes = !inQuotes;
                }
                continue;
            }

            if (ch == ',' && !inQuotes) {
                currentRow.add(cell.toString());
                cell.setLength(0);
                continue;
            }

            if ((ch == '\n' || ch == '\r') && !inQuotes) {
                if (ch == '\r' && i + 1 < csv.length() && csv.charAt(i + 1) == '\n') i++;
                currentRow.add(cell.toString());
                cell.setLength(0);
                rows.add(currentRow);
                currentRow = new ArrayList<>();
                continue;
            }

            cell.append(ch);
        }

        if (!currentRow.isEmpty() || cell.length() > 0) {
            currentRow.add(cell.toString());
            rows.add(currentRow);
        }

        return rows;
    }

    private List<List<String>> parseExcel(MultipartFile file) throws IOException {
        List<List<String>> rows = new ArrayList<>();
        try (XSSFWorkbook workbook = new XSSFWorkbook(file.getInputStream())) {
            Sheet sheet = workbook.getNumberOfSheets() > 0 ? workbook.getSheetAt(0) : null;
            if (sheet == null) return rows;

            for (Row row : sheet) {
                int cellCount = Math.max(1, row.getLastCellNum());
                List<String> cells = new ArrayList<>();
                for (int i = 0; i < cellCount; i++) {
                    var cell = row.getCell(i);
                    cells.add(cell == null ? "" : cell.toString());
                }
                rows.add(cells);
            }
        }
        return rows;
    }

    private byte[] exportAsCsv(List<Lead> leads) {
        String[] headers = {
            "name","email","phone","company","service","specialization","source",
            "score","status","value","assignedTo","createdAt","updatedAt","notes","tags"
        };
        StringBuilder sb = new StringBuilder(String.join(",", headers)).append('\n');

        for (Lead lead : leads) {
            List<String> row = List.of(
                safe(lead.getName()),
                safe(lead.getEmail()),
                safe(lead.getPhone()),
                safe(lead.getCompany()),
                safe(lead.getService()),
                safe(lead.getSpecialization()),
                lead.getSource() != null ? lead.getSource().name() : "",
                lead.getScore() != null ? lead.getScore().name() : "",
                lead.getStatus() != null ? lead.getStatus().name() : "",
                lead.getDealValue() != null ? lead.getDealValue().toPlainString() : "",
                lead.getAssignedTo() != null ? safe(lead.getAssignedTo().getName()) : "",
                lead.getCreatedAt() != null ? lead.getCreatedAt().toString() : "",
                lead.getUpdatedAt() != null ? lead.getUpdatedAt().toString() : "",
                safe(lead.getNotes()),
                lead.getTags() != null ? String.join(",", lead.getTags()) : ""
            );
            sb.append(row.stream().map(this::csvEscape).collect(Collectors.joining(","))).append('\n');
        }

        return sb.toString().getBytes(StandardCharsets.UTF_8);
    }

    private byte[] exportAsXlsx(List<Lead> leads) {
        try (XSSFWorkbook workbook = new XSSFWorkbook();
             ByteArrayOutputStream out = new ByteArrayOutputStream()) {
            Sheet sheet = workbook.createSheet("Leads");
            String[] headers = {
                "Name","Email","Phone","Company","Service","Specialization","Source",
                "Score","Status","Value","Assigned To","Created At","Updated At","Notes","Tags"
            };

            Row headerRow = sheet.createRow(0);
            for (int i = 0; i < headers.length; i++) {
                headerRow.createCell(i).setCellValue(headers[i]);
            }

            int rowIdx = 1;
            for (Lead lead : leads) {
                Row row = sheet.createRow(rowIdx++);
                row.createCell(0).setCellValue(safe(lead.getName()));
                row.createCell(1).setCellValue(safe(lead.getEmail()));
                row.createCell(2).setCellValue(safe(lead.getPhone()));
                row.createCell(3).setCellValue(safe(lead.getCompany()));
                row.createCell(4).setCellValue(safe(lead.getService()));
                row.createCell(5).setCellValue(safe(lead.getSpecialization()));
                row.createCell(6).setCellValue(lead.getSource() != null ? lead.getSource().name() : "");
                row.createCell(7).setCellValue(lead.getScore() != null ? lead.getScore().name() : "");
                row.createCell(8).setCellValue(lead.getStatus() != null ? lead.getStatus().name() : "");
                row.createCell(9).setCellValue(lead.getDealValue() != null ? lead.getDealValue().doubleValue() : 0d);
                row.createCell(10).setCellValue(lead.getAssignedTo() != null ? safe(lead.getAssignedTo().getName()) : "");
                row.createCell(11).setCellValue(lead.getCreatedAt() != null ? lead.getCreatedAt().toString() : "");
                row.createCell(12).setCellValue(lead.getUpdatedAt() != null ? lead.getUpdatedAt().toString() : "");
                row.createCell(13).setCellValue(safe(lead.getNotes()));
                row.createCell(14).setCellValue(lead.getTags() != null ? String.join(",", lead.getTags()) : "");
            }

            for (int i = 0; i < headers.length; i++) {
                sheet.autoSizeColumn(i);
            }

            workbook.write(out);
            return out.toByteArray();
        } catch (IOException e) {
            throw new IllegalStateException("Failed to export leads as XLSX", e);
        }
    }

    private String safe(String value) {
        return value == null ? "" : value;
    }

    private String csvEscape(String value) {
        String v = sanitizeCsvValue(value);
        return "\"" + v.replace("\"", "\"\"") + "\"";
    }

    private String fetchPublicSheetCsv(Map<String, String> config) {
        String spreadsheetId = trim(config.get("spreadsheetId"));
        String sheetName = trim(config.get("sheetName"));
        String gid = trim(config.get("gid"));
        String publishedCsvUrl = trim(config.get("publishedCsvUrl"));

        if (spreadsheetId == null || spreadsheetId.isBlank()) {
            throw new IllegalStateException("spreadsheetId is required.");
        }
        if (sheetName == null || sheetName.isBlank()) {
            throw new IllegalStateException("sheetName is required.");
        }

        List<String> urlsToTry = new ArrayList<>();
        if (publishedCsvUrl != null && !publishedCsvUrl.isBlank()) {
            if (!isAllowedGoogleSheetsUrl(publishedCsvUrl, spreadsheetId)) {
                throw new IllegalStateException("publishedCsvUrl must point to the same Google Sheets document.");
            }
            urlsToTry.add(publishedCsvUrl);
        }
        if (gid != null && !gid.isBlank()) {
            urlsToTry.add("https://docs.google.com/spreadsheets/d/" + spreadsheetId + "/export?format=csv&gid=" + gid);
        }
        urlsToTry.add("https://docs.google.com/spreadsheets/d/" + spreadsheetId
            + "/export?format=csv&sheet=" + URLEncoder.encode(sheetName, StandardCharsets.UTF_8));
        urlsToTry.add("https://docs.google.com/spreadsheets/d/" + spreadsheetId
            + "/gviz/tq?tqx=out:csv&sheet=" + URLEncoder.encode(sheetName, StandardCharsets.UTF_8));

        StringJoiner errors = new StringJoiner(" | ");
        HttpEntity<Void> requestEntity = buildCsvFetchRequestEntity();
        for (String csvUrl : urlsToTry) {
            try {
                ResponseEntity<String> response = restTemplate.exchange(
                    csvUrl,
                    HttpMethod.GET,
                    requestEntity,
                    String.class
                );
                String csv = response.getBody();
                if (csv == null || csv.isBlank()) {
                    errors.add("empty response");
                    continue;
                }

                String sniff = csv.trim().toLowerCase(Locale.ROOT);
                if (sniff.startsWith("<!doctype html") || sniff.startsWith("<html")) {
                    errors.add("non-csv html response");
                    continue;
                }
                return csv;
            } catch (RestClientException ex) {
                errors.add(ex.getClass().getSimpleName());
            }
        }

        throw new IllegalStateException(
            "Failed to fetch Google Sheet CSV. Make sure sharing is 'Anyone with link - Viewer', sheet tab is exact, and gid is correct. Details: " + errors
        );
    }

    private String sanitizeCsvValue(String value) {
        String v = value == null ? "" : value;
        if (v.isEmpty()) {
            return v;
        }
        char first = v.charAt(0);
        if (first == '=' || first == '+' || first == '-' || first == '@' || first == '\t') {
            return "'" + v;
        }
        return v;
    }

    private boolean isAllowedGoogleSheetsUrl(String csvUrl, String spreadsheetId) {
        try {
            URI uri = URI.create(csvUrl);
            String host = uri.getHost() != null ? uri.getHost().toLowerCase(Locale.ROOT) : "";
            if (!host.equals("docs.google.com") && !host.endsWith(".google.com")) {
                return false;
            }
            String path = uri.getPath() != null ? uri.getPath() : "";
            return path.contains("/spreadsheets/d/" + spreadsheetId);
        } catch (Exception ex) {
            return false;
        }
    }

    private HttpEntity<Void> buildCsvFetchRequestEntity() {
        HttpHeaders headers = new HttpHeaders();
        headers.set(HttpHeaders.USER_AGENT, "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36");
        headers.set(HttpHeaders.ACCEPT, "text/csv,application/csv,text/plain,*/*");
        headers.set(HttpHeaders.ACCEPT_LANGUAGE, "en-US,en;q=0.9");
        headers.setCacheControl("no-cache");
        headers.setPragma("no-cache");
        headers.setAccept(List.of(MediaType.TEXT_PLAIN, MediaType.ALL));
        return new HttpEntity<>(headers);
    }

    // ── Mapping helpers ──────────────────────────────────────────

    private LeadDTO toDTO(Lead l, Map<String, String> assignedNameById) {
        String assignedToId = l.getAssignedTo() != null ? l.getAssignedTo().getId() : null;
        String assignedToName = assignedToId != null ? assignedNameById.get(assignedToId) : null;
        return toDTO(l, assignedToId, assignedToName);
    }

    private LeadDTO toDTO(Lead l) {
        String assignedToId = l.getAssignedTo() != null ? l.getAssignedTo().getId() : null;
        String assignedToName = l.getAssignedTo() != null ? l.getAssignedTo().getName() : null;
        return toDTO(l, assignedToId, assignedToName);
    }

    private LeadDTO toDTO(Lead l, String assignedToId, String assignedToName) {
        return LeadDTO.builder()
            .id(l.getId())
            .name(l.getName())
            .email(l.getEmail())
            .phone(l.getPhone())
            .company(l.getCompany())
            .designation(l.getDesignation())
            .service(l.getService())
            .specialization(l.getSpecialization())
            .source(l.getSource())
            .status(l.getStatus())
            .score(l.getScore())
            .priority(l.getPriority())
            .dealValue(l.getDealValue())
            .utmSource(l.getUtmSource())
            .utmMedium(l.getUtmMedium())
            .utmCampaign(l.getUtmCampaign())
            .aiScoreValue(l.getAiScoreValue())
            .aiNextAction(l.getAiNextAction())
            .assignedToId(assignedToId)
            .assignedToName(assignedToName)
            .tags(l.getTags())
            .notes(l.getNotes())
            .convertedAt(l.getConvertedAt())
            .lostReason(l.getLostReason())
            .followUpDate(l.getFollowUpDate())
            .revenueValue(l.getRevenueValue())
            .activityLogs(l.getActivityLogs())
            .facebookLeadId(l.getFacebookLeadId())
            .facebookFormId(l.getFacebookFormId())
            .facebookAdId(l.getFacebookAdId())
            .createdAt(l.getCreatedAt())
            .updatedAt(l.getUpdatedAt())
            .lastContactedAt(l.getLastContactedAt())
            .build();
    }

    private Lead fromDTO(LeadDTO dto) {
        Lead.LeadBuilder builder = Lead.builder()
            .name(dto.getName())
            .email(dto.getEmail())
            .phone(normalizePhone(dto.getPhone()))
            .company(dto.getCompany())
            .designation(dto.getDesignation())
            .service(dto.getService())
            .specialization(dto.getSpecialization())
            .source(dto.getSource())
            .status(dto.getStatus() != null ? dto.getStatus() : Lead.LeadStatus.NEW)
            .score(dto.getScore() != null ? dto.getScore() : Lead.LeadScore.COLD)
            .priority(dto.getPriority() != null ? dto.getPriority() : Lead.LeadPriority.MEDIUM)
            .dealValue(dto.getDealValue())
            .utmSource(dto.getUtmSource())
            .utmMedium(dto.getUtmMedium())
            .utmCampaign(dto.getUtmCampaign())
            .tags(dto.getTags())
            .notes(dto.getNotes())
            .facebookLeadId(dto.getFacebookLeadId())
            .facebookFormId(dto.getFacebookFormId())
            .facebookAdId(dto.getFacebookAdId())
            .convertedAt(dto.getConvertedAt())
            .lostReason(dto.getLostReason())
            .followUpDate(dto.getFollowUpDate())
            .revenueValue(dto.getRevenueValue())
            .activityLogs(dto.getActivityLogs());

        if (dto.getAssignedToId() != null && !dto.getAssignedToId().isBlank()) {
            userRepository.findByIdAndTenantIdAndDeletedFalse(dto.getAssignedToId(), tenantId())
                .ifPresent(builder::assignedTo);
        }

        return builder.build();
    }
}
