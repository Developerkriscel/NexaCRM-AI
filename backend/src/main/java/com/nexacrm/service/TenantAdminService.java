package com.nexacrm.service;

import com.nexacrm.model.AuditLog;
import com.nexacrm.model.Tenant;
import com.nexacrm.repository.AuditLogRepository;
import com.nexacrm.repository.DealRepository;
import com.nexacrm.repository.InvoiceRepository;
import com.nexacrm.repository.LeadRepository;
import com.nexacrm.repository.TenantRepository;
import com.nexacrm.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Transactional
public class TenantAdminService {

    private final TenantRepository tenantRepository;
    private final UserRepository userRepository;
    private final LeadRepository leadRepository;
    private final DealRepository dealRepository;
    private final InvoiceRepository invoiceRepository;
    private final AuditLogRepository auditLogRepository;

    @Transactional(readOnly = true)
    public List<Map<String, Object>> listTenants() {
        return tenantRepository.findAll().stream()
            .sorted((a, b) -> {
                LocalDateTime right = b.getCreatedAt() != null ? b.getCreatedAt() : LocalDateTime.MIN;
                LocalDateTime left = a.getCreatedAt() != null ? a.getCreatedAt() : LocalDateTime.MIN;
                return right.compareTo(left);
            })
            .map(this::tenantSummary)
            .collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public Map<String, Object> getBillingDashboard() {
        List<Tenant> tenants = tenantRepository.findAll();
        long active = tenants.stream().filter(t -> Boolean.TRUE.equals(t.getIsActive())).count();
        long inactive = tenants.size() - active;
        long trialing = tenants.stream().filter(t -> "TRIAL".equalsIgnoreCase(defaultString(t.getBillingStatus()))).count();
        long expiringSoon = tenants.stream()
            .filter(t -> t.getTrialEndsAt() != null)
            .filter(t -> t.getTrialEndsAt().isBefore(LocalDateTime.now().plusDays(7)))
            .count();

        List<Map<String, Object>> planBreakdown = tenants.stream()
            .collect(Collectors.groupingBy(
                tenant -> defaultString(tenant.getPlan()).toUpperCase(),
                LinkedHashMap::new,
                Collectors.counting()
            ))
            .entrySet().stream()
            .map(entry -> Map.<String, Object>of("plan", entry.getKey(), "count", entry.getValue()))
            .toList();

        return Map.of(
            "totalTenants", tenants.size(),
            "activeTenants", active,
            "inactiveTenants", inactive,
            "trialTenants", trialing,
            "expiringSoon", expiringSoon,
            "plans", planBreakdown
        );
    }

    @Transactional(readOnly = true)
    public List<Map<String, Object>> featureCatalog() {
        return List.of(
            Map.of("key", "lead_automation", "label", "Lead Automation", "description", "Auto-assign, SLA and escalation rules"),
            Map.of("key", "team_management", "label", "Team Management", "description", "Invite users, manage roles and teams"),
            Map.of("key", "billing_dashboard", "label", "Billing Dashboard", "description", "Tenant invoices, plan state and trial expiry"),
            Map.of("key", "webhook_hardening", "label", "Webhook Hardening", "description", "Signature verification and replay protection"),
            Map.of("key", "realtime_notifications", "label", "Realtime Notifications", "description", "Live websocket and toast notifications")
        );
    }

    @Transactional(readOnly = true)
    public List<Map<String, Object>> plans() {
        return List.of(
            plan("TRIAL", 0, 5, 14, "Core CRM, tasks, notifications"),
            plan("STARTER", 4999, 10, 30, "Lead, deal and invoice management"),
            plan("BUSINESS", 14999, 25, 60, "Automation, reports and webhooks"),
            plan("ENTERPRISE", 49999, 100, 365, "SSO, SaaS controls and priority support")
        );
    }

    public Map<String, Object> createTenant(Map<String, Object> body) {
        Tenant tenant = Tenant.builder()
            .name(string(body.get("name"), "New Tenant"))
            .slug(slugify(string(body.get("slug"), "new-tenant")))
            .plan(string(body.get("plan"), "TRIAL"))
            .isActive(bool(body.get("isActive"), true))
            .maxUsers(number(body.get("maxUsers"), 5))
            .logoUrl(string(body.get("logoUrl"), null))
            .billingStatus(string(body.get("billingStatus"), "TRIAL"))
            .trialEndsAt(parseDateTime(body.get("trialEndsAt")))
            .subscriptionStartedAt(parseDateTime(body.get("subscriptionStartedAt")))
            .subscriptionEndsAt(parseDateTime(body.get("subscriptionEndsAt")))
            .build();
        tenant.setFeatureFlags(parseBooleanMap(body.get("featureFlags")));
        tenant.setUsageLimits(parseIntegerMap(body.get("usageLimits")));
        return tenantSummary(tenantRepository.save(tenant));
    }

    public Map<String, Object> updateTenant(String id, Map<String, Object> body) {
        Tenant tenant = tenantRepository.findById(id)
            .orElseThrow(() -> new IllegalArgumentException("Tenant not found: " + id));
        if (body.containsKey("name")) tenant.setName(string(body.get("name"), tenant.getName()));
        if (body.containsKey("slug")) tenant.setSlug(slugify(string(body.get("slug"), tenant.getSlug())));
        if (body.containsKey("plan")) tenant.setPlan(string(body.get("plan"), tenant.getPlan()));
        if (body.containsKey("isActive")) tenant.setIsActive(bool(body.get("isActive"), tenant.getIsActive()));
        if (body.containsKey("maxUsers")) tenant.setMaxUsers(number(body.get("maxUsers"), tenant.getMaxUsers()));
        if (body.containsKey("logoUrl")) tenant.setLogoUrl(string(body.get("logoUrl"), tenant.getLogoUrl()));
        if (body.containsKey("billingStatus")) tenant.setBillingStatus(string(body.get("billingStatus"), tenant.getBillingStatus()));
        if (body.containsKey("trialEndsAt")) tenant.setTrialEndsAt(parseDateTime(body.get("trialEndsAt")));
        if (body.containsKey("subscriptionStartedAt")) tenant.setSubscriptionStartedAt(parseDateTime(body.get("subscriptionStartedAt")));
        if (body.containsKey("subscriptionEndsAt")) tenant.setSubscriptionEndsAt(parseDateTime(body.get("subscriptionEndsAt")));
        if (body.containsKey("featureFlags")) tenant.setFeatureFlags(parseBooleanMap(body.get("featureFlags")));
        if (body.containsKey("usageLimits")) tenant.setUsageLimits(parseIntegerMap(body.get("usageLimits")));
        return tenantSummary(tenantRepository.save(tenant));
    }

    public Map<String, Object> setActive(String id, boolean active) {
        Tenant tenant = tenantRepository.findById(id)
            .orElseThrow(() -> new IllegalArgumentException("Tenant not found: " + id));
        tenant.setIsActive(active);
        if (active) {
            tenant.setDeactivatedAt(null);
            tenant.setActivatedAt(LocalDateTime.now());
        } else {
            tenant.setDeactivatedAt(LocalDateTime.now());
        }
        return tenantSummary(tenantRepository.save(tenant));
    }

    @Transactional(readOnly = true)
    public List<Map<String, Object>> globalAuditLogs() {
        return auditLogRepository.findTop100ByOrderByCreatedAtDesc().stream().map(this::auditRow).toList();
    }

    private Map<String, Object> tenantSummary(Tenant tenant) {
        Long tenantId = tenant.getTenantId();
        long userCount = tenantId != null ? userRepository.findByTenantIdAndDeletedFalse(tenantId).size() : 0L;
        long leadCount = tenantId != null ? leadRepository.findByTenantIdAndDeletedFalse(tenantId).size() : 0L;
        long dealCount = tenantId != null ? dealRepository.findByTenantIdAndDeletedFalse(tenantId).size() : 0L;
        long invoiceCount = tenantId != null ? invoiceRepository.findByTenantIdAndDeletedFalse(tenantId).size() : 0L;
        Map<String, Object> row = new LinkedHashMap<>();
        row.put("id", tenant.getId());
        row.put("tenantId", tenant.getTenantId());
        row.put("name", tenant.getName());
        row.put("slug", tenant.getSlug());
        row.put("plan", tenant.getPlan());
        row.put("billingStatus", tenant.getBillingStatus());
        row.put("isActive", tenant.getIsActive());
        row.put("maxUsers", tenant.getMaxUsers());
        row.put("logoUrl", tenant.getLogoUrl());
        row.put("trialEndsAt", tenant.getTrialEndsAt());
        row.put("subscriptionStartedAt", tenant.getSubscriptionStartedAt());
        row.put("subscriptionEndsAt", tenant.getSubscriptionEndsAt());
        row.put("featureFlags", tenant.getFeatureFlags());
        row.put("usageLimits", tenant.getUsageLimits());
        row.put("userCount", userCount);
        row.put("leadCount", leadCount);
        row.put("dealCount", dealCount);
        row.put("invoiceCount", invoiceCount);
        row.put("createdAt", tenant.getCreatedAt());
        row.put("updatedAt", tenant.getUpdatedAt());
        return row;
    }

    private Map<String, Object> auditRow(AuditLog auditLog) {
        Map<String, Object> row = new LinkedHashMap<>();
        row.put("id", auditLog.getId());
        row.put("tenantId", auditLog.getTenantId());
        row.put("userId", auditLog.getUserId());
        row.put("action", auditLog.getAction());
        row.put("entityType", auditLog.getEntityType());
        row.put("entityId", auditLog.getEntityId());
        row.put("ipAddress", auditLog.getIpAddress());
        row.put("userAgent", auditLog.getUserAgent());
        row.put("createdAt", auditLog.getCreatedAt());
        return row;
    }

    private Map<String, Object> plan(String name, int priceInRupees, int maxUsers, int trialDays, String features) {
        return Map.of(
            "name", name,
            "priceInRupees", priceInRupees,
            "maxUsers", maxUsers,
            "trialDays", trialDays,
            "features", features
        );
    }

    private String defaultString(String value) {
        return value == null ? "" : value;
    }

    private String string(Object value, String fallback) {
        if (value == null) return fallback;
        String text = String.valueOf(value).trim();
        return text.isBlank() ? fallback : text;
    }

    private boolean bool(Object value, boolean fallback) {
        if (value == null) return fallback;
        if (value instanceof Boolean b) return b;
        return Boolean.parseBoolean(String.valueOf(value));
    }

    private Integer number(Object value, Integer fallback) {
        if (value == null) return fallback;
        if (value instanceof Number n) return n.intValue();
        try {
            return Integer.parseInt(String.valueOf(value).trim());
        } catch (Exception ex) {
            return fallback;
        }
    }
    private LocalDateTime parseDateTime(Object value) {
        if (value == null) return null;
        try {
            return LocalDateTime.parse(String.valueOf(value));
        } catch (Exception ex) {
            return null;
        }
    }

    @SuppressWarnings("unchecked")
    private Map<String, Boolean> parseBooleanMap(Object value) {
        Map<String, Boolean> result = new LinkedHashMap<>();
        if (!(value instanceof Map<?, ?> map)) {
            return result;
        }
        map.forEach((key, val) -> result.put(String.valueOf(key), bool(val, false)));
        return result;
    }

    @SuppressWarnings("unchecked")
    private Map<String, Integer> parseIntegerMap(Object value) {
        Map<String, Integer> result = new LinkedHashMap<>();
        if (!(value instanceof Map<?, ?> map)) {
            return result;
        }
        map.forEach((key, val) -> result.put(String.valueOf(key), number(val, 0)));
        return result;
    }

    private String slugify(String value) {
        if (value == null) {
            return "";
        }
        return value.trim()
            .toLowerCase()
            .replaceAll("[^a-z0-9]+", "-")
            .replaceAll("^-|-$", "");
    }
}
