package com.nexacrm.repository;

import com.nexacrm.model.FileAttachment;
import org.springframework.data.mongodb.repository.MongoRepository;

import java.util.List;
import java.util.Optional;

public interface FileAttachmentRepository extends MongoRepository<FileAttachment, String> {
    List<FileAttachment> findByTenantIdAndEntityTypeAndEntityIdAndDeletedFalseOrderByCreatedAtDesc(Long tenantId, String entityType, String entityId);
    Optional<FileAttachment> findByIdAndTenantIdAndDeletedFalse(String id, Long tenantId);
}
