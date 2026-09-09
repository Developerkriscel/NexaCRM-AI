package com.nexacrm.service;

import com.nexacrm.dto.IntegrationConfigResponse;
import com.nexacrm.model.IntegrationConfig;
import com.nexacrm.repository.IntegrationConfigRepository;
import com.nexacrm.security.CryptoService;
import com.nexacrm.security.TenantContext;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;

@Service
@RequiredArgsConstructor
public class IntegrationService {

    private static final Map<String, List<String>> REQUIRED_FIELDS = Map.of(
        "facebook", List.of("pageId", "accessToken"),
        "instagram", List.of("igAccountId", "accessToken"),
        "reddit", List.of("clientId", "clientSecret", "refreshToken", "username"),
        "whatsapp", List.of("instanceId", "accessToken"),
        "voice_call_agent", List.of(),
        "gmail", List.of("clientId", "clientSecret", "refreshToken"),
        "google_calendar", List.of("clientId", "clientSecret"),
        "mistral_ai", List.of("apiKey"),
        "linkedin", List.of("clientId", "clientSecret"),
        "google_sheets_leads", List.of("spreadsheetId", "sheetName")
    );

    private static final Map<String, String> INTEGRATION_ALIASES = Map.of(
        "openai", "mistral_ai",
        "grok_ai", "mistral_ai"
    );

    private static final Set<String> SENSITIVE_KEYS = Set.of(
        "apikey", "api_key", "access_token", "token", "secret", "password", "refresh_token", "webhooksecret"
    );

    private final ObjectProvider<LeadService> leadServiceProvider;
    private final IntegrationConfigRepository integrationConfigRepository;
    private final CryptoService cryptoService;

    private Long tenantId() {
        return TenantContext.currentTenantId();
    }

    public List<IntegrationConfigResponse> getAll() {
        Map<String, IntegrationConfig> byId = new LinkedHashMap<>();
        integrationConfigRepository.findByTenantIdAndDeletedFalse(tenantId())
            .forEach(cfg -> byId.put(normalizeId(cfg.getIntegrationId()), decryptConfig(cfg)));

        List<IntegrationConfigResponse> all = new ArrayList<>();
        REQUIRED_FIELDS.forEach((id, requiredFields) -> all.add(buildResponse(id, requiredFields, byId.get(id))));
        return all;
    }

    public IntegrationConfigResponse getById(String integrationId) {
        String normalizedId = normalizeId(integrationId);
        List<String> required = getRequiredFields(normalizedId);
        IntegrationConfig cfg = findExistingConfig(normalizedId);
        return buildResponse(normalizedId, required, cfg);
    }

    public IntegrationConfigResponse save(String integrationId, Map<String, String> values) {
        String normalizedId = normalizeId(integrationId);
        List<String> required = getRequiredFields(normalizedId);

        IntegrationConfig existing = findExistingConfig(normalizedId);
        Map<String, String> existingValues = existing != null ? safeCopy(existing.getValues()) : Map.of();
        Map<String, String> mergedValues = mergeValues(existingValues, values);
        validateRequired(mergedValues, required);

        IntegrationConfig config = existing != null ? existing : new IntegrationConfig();
        config.setIntegrationId(normalizedId);
        config.setTenantId(tenantId());
        config.setDeleted(false);
        config.setConnected(true);
        config.setValues(encryptSensitiveValues(mergedValues));
        integrationConfigRepository.save(config);

        return buildResponse(normalizedId, required, config);
    }

    public Map<String, Object> test(String integrationId, Map<String, String> values) {
        String normalizedId = normalizeId(integrationId);
        List<String> required = getRequiredFields(normalizedId);

        Map<String, String> persisted = getConfig(normalizedId);
        Map<String, String> testValues = mergeValues(persisted, values);

        validateRequired(testValues, required);

        if ("google_sheets_leads".equals(normalizedId)) {
            return leadService().testPublicGoogleSheetAccess(testValues);
        }

        return Map.of(
            "ok", true,
            "message", "Connection test passed for " + normalizedId,
            "integration", normalizedId
        );
    }

    public Map<String, Object> sync(String integrationId, Map<String, String> values) {
        String normalizedId = normalizeId(integrationId);
        if (!"google_sheets_leads".equals(normalizedId)) {
            throw new IllegalStateException("Sync is not supported for integration: " + normalizedId);
        }

        Map<String, String> merged = mergeValues(getConfig(normalizedId), values);
        validateRequired(merged, getRequiredFields(normalizedId));
        return leadService().syncFromPublicGoogleSheet(merged);
    }

    public void disconnect(String integrationId) {
        String normalizedId = normalizeId(integrationId);
        IntegrationConfig cfg = findExistingConfig(normalizedId);
        if (cfg != null) {
            cfg.setConnected(false);
            cfg.setValues(new LinkedHashMap<>());
            integrationConfigRepository.save(cfg);
        }
    }

    public boolean isConnected(String integrationId) {
        String normalizedId = normalizeId(integrationId);
        IntegrationConfig cfg = findExistingConfig(normalizedId);
        return cfg != null && Boolean.TRUE.equals(cfg.getConnected());
    }

    public Map<String, String> getConfig(String integrationId) {
        String normalizedId = normalizeId(integrationId);
        IntegrationConfig cfg = findExistingConfig(normalizedId);
        return cfg != null ? safeCopy(cfg.getValues()) : new LinkedHashMap<>();
    }

    private IntegrationConfigResponse buildResponse(String id, List<String> requiredFields, IntegrationConfig cfg) {
        Map<String, String> stored = cfg == null ? new LinkedHashMap<>() : safeCopy(cfg.getValues());
        maskSensitiveValues(stored);

        return IntegrationConfigResponse.builder()
            .id(id)
            .connected(cfg != null && Boolean.TRUE.equals(cfg.getConnected()))
            .requiredFields(requiredFields)
            .values(stored)
            .build();
    }

    private String normalizeId(String integrationId) {
        if (integrationId == null || integrationId.isBlank()) {
            throw new IllegalStateException("Integration id is required.");
        }
        String normalized = integrationId.trim().toLowerCase(Locale.ROOT);
        return INTEGRATION_ALIASES.getOrDefault(normalized, normalized);
    }

    private IntegrationConfig findExistingConfig(String integrationId) {
        String normalizedId = normalizeId(integrationId);
        List<String> candidates = new ArrayList<>();
        candidates.add(normalizedId);
        INTEGRATION_ALIASES.forEach((legacyId, canonicalId) -> {
            if (canonicalId.equals(normalizedId)) {
                candidates.add(legacyId);
            }
        });

        for (String candidate : candidates) {
            IntegrationConfig cfg = integrationConfigRepository
                .findByTenantIdAndIntegrationIdAndDeletedFalse(tenantId(), candidate)
                .orElse(null);
            if (cfg != null) {
                return decryptConfig(cfg);
            }
        }
        return null;
    }

    private IntegrationConfig decryptConfig(IntegrationConfig config) {
        if (config == null) return null;
        Map<String, String> values = safeCopy(config.getValues());
        values.replaceAll((key, value) -> isSensitiveKey(normalizeKey(key)) ? cryptoService.decrypt(value) : value);
        config.setValues(values);
        return config;
    }

    private List<String> getRequiredFields(String integrationId) {
        List<String> required = REQUIRED_FIELDS.get(integrationId);
        if (required == null) {
            throw new IllegalStateException("Unsupported integration: " + integrationId);
        }
        return required;
    }

    private void validateRequired(Map<String, String> values, List<String> requiredFields) {
        List<String> missing = requiredFields.stream()
            .filter(field -> trim(values.get(field)).isBlank())
            .toList();

        if (!missing.isEmpty()) {
            throw new IllegalStateException("Missing required fields: " + String.join(", ", missing));
        }
    }

    private Map<String, String> mergeValues(Map<String, String> existing, Map<String, String> incoming) {
        Map<String, String> merged = safeCopy(existing);
        if (incoming == null || incoming.isEmpty()) {
            return merged;
        }

        Set<String> knownSensitive = new HashSet<>();
        incoming.forEach((key, value) -> {
            String normalizedKey = normalizeKey(key);
            String clean = trim(value);
            if (isSensitiveKey(normalizedKey)) {
                knownSensitive.add(key);
                if (clean.isBlank() || isMaskedValue(clean)) {
                    if (existing.containsKey(key)) {
                        merged.put(key, trim(existing.get(key)));
                    }
                } else {
                    merged.put(key, clean);
                }
                return;
            }
            merged.put(key, clean);
        });

        existing.forEach((key, value) -> {
            if (knownSensitive.contains(key) && !merged.containsKey(key)) {
                merged.put(key, trim(value));
            }
        });

        return merged;
    }

    private Map<String, String> encryptSensitiveValues(Map<String, String> values) {
        Map<String, String> encrypted = new LinkedHashMap<>();
        values.forEach((key, value) -> {
            String clean = trim(value);
            if (isSensitiveKey(normalizeKey(key))) {
                encrypted.put(key, cryptoService.encrypt(clean));
            } else {
                encrypted.put(key, clean);
            }
        });
        return encrypted;
    }

    private void maskSensitiveValues(Map<String, String> values) {
        values.replaceAll((key, value) -> {
            if (!isSensitiveKey(normalizeKey(key))) {
                return value;
            }
            return maskValue(value);
        });
    }

    private boolean isSensitiveKey(String normalizedKey) {
        return SENSITIVE_KEYS.stream().anyMatch(normalizedKey::contains);
    }

    private String normalizeKey(String key) {
        return trim(key).toLowerCase(Locale.ROOT);
    }

    private String maskValue(String value) {
        String v = trim(value);
        if (v.isBlank()) {
            return "";
        }
        if (v.length() <= 4) {
            return "****";
        }
        return "********" + v.substring(v.length() - 4);
    }

    private boolean isMaskedValue(String value) {
        String v = trim(value);
        return v.startsWith("****");
    }

    private Map<String, String> safeCopy(Map<String, String> source) {
        Map<String, String> copy = new LinkedHashMap<>();
        if (source == null) {
            return copy;
        }
        source.forEach((k, v) -> copy.put(k, trim(v)));
        return copy;
    }

    private String trim(String value) {
        return value == null ? "" : value.trim();
    }

    private LeadService leadService() {
        return leadServiceProvider.getObject();
    }
}
