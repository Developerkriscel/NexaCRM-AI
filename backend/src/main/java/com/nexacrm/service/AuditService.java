package com.nexacrm.service;

import com.nexacrm.model.AuditLog;
import com.nexacrm.model.User;
import com.nexacrm.repository.AuditLogRepository;
import com.nexacrm.repository.UserRepository;
import com.nexacrm.security.TenantContext;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.LinkedHashMap;
import java.util.Map;

@Service
@RequiredArgsConstructor
public class AuditService {

    private final AuditLogRepository auditLogRepository;
    private final UserRepository userRepository;

    @Transactional
    public void logAction(String action, String entityType, String entityId, HttpServletRequest request) {
        logAction(action, entityType, entityId, null, null, request);
    }

    @Transactional
    public void logAction(
        String action,
        String entityType,
        String entityId,
        Map<String, Object> oldValues,
        Map<String, Object> newValues,
        HttpServletRequest request
    ) {
        User actor = currentUserOrNull();
        AuditLog log = AuditLog.builder()
            .action(action)
            .entityType(entityType)
            .entityId(entityId)
            .oldValues(oldValues != null ? new LinkedHashMap<>(oldValues) : null)
            .newValues(newValues != null ? new LinkedHashMap<>(newValues) : null)
            .ipAddress(resolveIp(request))
            .userAgent(request != null ? request.getHeader("User-Agent") : null)
            .build();
        log.setTenantId(resolveTenantId(actor));
        log.setUserId(actor != null ? actor.getId() : "system");
        auditLogRepository.save(log);
    }

    @Transactional(readOnly = true)
    public java.util.List<AuditLog> recentTenantLogs(Long tenantId) {
        if (tenantId == null) {
            return auditLogRepository.findTop100ByOrderByCreatedAtDesc();
        }
        return auditLogRepository.findTop100ByTenantIdOrderByCreatedAtDesc(tenantId);
    }

    private String resolveIp(HttpServletRequest request) {
        if (request == null) {
            return null;
        }
        String forwarded = request.getHeader("X-Forwarded-For");
        if (forwarded != null && !forwarded.isBlank()) {
            return forwarded.split(",")[0].trim();
        }
        String realIp = request.getHeader("X-Real-IP");
        if (realIp != null && !realIp.isBlank()) {
            return realIp.trim();
        }
        return request.getRemoteAddr();
    }

    private User currentUserOrNull() {
        try {
            String email = SecurityContextHolder.getContext().getAuthentication().getName();
            Long tenantId = TenantContext.currentTenantIdOrNull();
            if (email == null || email.isBlank() || tenantId == null) {
                return null;
            }
            return userRepository.findByEmailAndTenantIdAndDeletedFalse(email, tenantId).orElse(null);
        } catch (Exception ignored) {
            return null;
        }
    }

    private Long resolveTenantId(User actor) {
        Long tenantId = TenantContext.currentTenantIdOrNull();
        if (tenantId != null) {
            return tenantId;
        }
        return actor != null ? actor.getTenantId() : 0L;
    }
}
