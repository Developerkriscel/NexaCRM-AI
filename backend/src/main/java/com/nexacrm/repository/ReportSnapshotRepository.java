package com.nexacrm.repository;

import com.nexacrm.model.ReportSnapshot;
import org.springframework.data.mongodb.repository.MongoRepository;

import java.util.List;

public interface ReportSnapshotRepository extends MongoRepository<ReportSnapshot, String> {
    List<ReportSnapshot> findByTenantIdAndReportTypeAndDeletedFalseOrderByCreatedAtDesc(Long tenantId, String reportType);
}
