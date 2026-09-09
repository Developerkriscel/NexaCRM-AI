package com.nexacrm.controller;

import com.nexacrm.repository.*;
import com.nexacrm.security.TenantContext;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/admin")
@RequiredArgsConstructor
@PreAuthorize("hasAnyRole('SUPER_ADMIN', 'COMPANY_ADMIN', 'ADMIN')")
public class AdminController {

    private final UserRepository userRepository;
    private final LeadRepository leadRepository;
    private final DealRepository dealRepository;
    private final CustomerRepository customerRepository;
    private final InvoiceRepository invoiceRepository;

    @GetMapping("/stats")
    public ResponseEntity<Map<String, Object>> getStats() {
        Long tenantId = TenantContext.currentTenantIdOrNull();
        if (tenantId == null) {
            return ResponseEntity.badRequest().build();
        }
        long totalUsers     = userRepository.countByTenantIdAndDeletedFalse(tenantId);
        long activeUsers    = userRepository.countByTenantIdAndDeletedFalseAndIsActiveTrue(tenantId);
        long totalLeads     = leadRepository.countByTenantIdAndDeletedFalse(tenantId);
        long totalDeals     = dealRepository.countByTenantIdAndDeletedFalse(tenantId);
        long totalCustomers = customerRepository.countByTenantIdAndDeletedFalse(tenantId);
        long totalInvoices  = invoiceRepository.countByTenantIdAndDeletedFalse(tenantId);

        return ResponseEntity.ok(Map.of(
            "totalUsers",     totalUsers,
            "activeUsers",    activeUsers,
            "totalLeads",     totalLeads,
            "totalDeals",     totalDeals,
            "totalCustomers", totalCustomers,
            "totalInvoices",  totalInvoices
        ));
    }
}
