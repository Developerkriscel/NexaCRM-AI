package com.nexacrm.repository;

import com.nexacrm.model.AuditLog;
import org.springframework.data.mongodb.repository.MongoRepository;

import java.util.List;

public interface AuditLogRepository extends MongoRepository<AuditLog, String> {
    List<AuditLog> findTop100ByTenantIdAndEntityTypeOrderByCreatedAtDesc(Long tenantId, String entityType);
    List<AuditLog> findTop100ByTenantIdOrderByCreatedAtDesc(Long tenantId);
    List<AuditLog> findTop100ByOrderByCreatedAtDesc();
}
