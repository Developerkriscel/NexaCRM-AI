package com.nexacrm.repository;

import com.nexacrm.model.FollowUp;
import org.springframework.data.mongodb.repository.MongoRepository;

import java.util.List;
import java.util.Optional;

public interface FollowUpRepository extends MongoRepository<FollowUp, String> {
    List<FollowUp> findByTenantIdAndDeletedFalseOrderByDueAtAsc(Long tenantId);
    List<FollowUp> findByTenantIdAndAssignedToIdAndDeletedFalseOrderByDueAtAsc(Long tenantId, String assignedToId);
    Optional<FollowUp> findByIdAndTenantIdAndDeletedFalse(String id, Long tenantId);
}
