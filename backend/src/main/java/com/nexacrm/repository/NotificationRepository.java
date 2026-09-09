package com.nexacrm.repository;

import com.nexacrm.model.Notification;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.mongodb.repository.MongoRepository;

import java.util.Optional;
import java.util.List;

public interface NotificationRepository extends MongoRepository<Notification, String> {

    Page<Notification> findByUser_IdAndDeletedFalseOrderByCreatedAtDesc(String userId, Pageable pageable);

    long countByUser_IdAndIsReadFalseAndDeletedFalse(String userId);

    List<Notification> findByUser_IdAndIsReadFalseAndDeletedFalse(String userId);

    Optional<Notification> findByIdAndUser_IdAndDeletedFalse(String id, String userId);

    boolean existsByUser_IdAndEntityTypeAndEntityIdAndTitleAndDeletedFalse(String userId, String entityType, String entityId, String title);
}
