package com.nexacrm.repository;

import com.nexacrm.model.Task;
import org.springframework.data.mongodb.repository.MongoRepository;

import java.util.List;
import java.util.Optional;

public interface TaskRepository extends MongoRepository<Task, String> {
    List<Task> findByTenantIdAndDeletedFalseOrderByDueDateAsc(Long tenantId);
    List<Task> findByTenantIdAndAssignedToIdAndDeletedFalseOrderByDueDateAsc(Long tenantId, String assignedToId);
    Optional<Task> findByIdAndTenantIdAndDeletedFalse(String id, Long tenantId);
}
