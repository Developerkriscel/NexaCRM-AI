package com.nexacrm.repository;

import com.nexacrm.model.Pipeline;
import org.springframework.data.mongodb.repository.MongoRepository;

import java.util.List;
import java.util.Optional;

public interface PipelineRepository extends MongoRepository<Pipeline, String> {
    List<Pipeline> findByTenantIdAndDeletedFalse(Long tenantId);
    Optional<Pipeline> findByIdAndTenantIdAndDeletedFalse(String id, Long tenantId);
}
