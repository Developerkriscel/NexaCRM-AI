package com.nexacrm.repository;

import com.nexacrm.model.PipelineStage;
import org.springframework.data.mongodb.repository.MongoRepository;

import java.util.List;
import java.util.Optional;

public interface PipelineStageRepository extends MongoRepository<PipelineStage, String> {
    List<PipelineStage> findByTenantIdAndPipelineIdAndDeletedFalseOrderByPositionAsc(Long tenantId, Long pipelineId);
    Optional<PipelineStage> findByTenantIdAndPipelineIdAndKeyAndDeletedFalse(Long tenantId, Long pipelineId, String key);
}
