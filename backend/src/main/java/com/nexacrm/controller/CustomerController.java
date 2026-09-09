package com.nexacrm.controller;

import com.nexacrm.dto.CustomerDTO;
import com.nexacrm.dto.PageResponse;
import com.nexacrm.service.CustomerService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Pageable;
import org.springframework.data.web.PageableDefault;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/customers")
@RequiredArgsConstructor
@Tag(name = "Customers", description = "Customer management endpoints")
public class CustomerController {

    private final CustomerService customerService;

    @GetMapping
    @PreAuthorize("hasAuthority('customers.read')")
    @Operation(summary = "Get all customers with pagination and filters")
    public ResponseEntity<PageResponse<CustomerDTO>> getCustomers(
            @RequestParam(required = false) String search,
            @RequestParam(required = false) String status,
            @PageableDefault(size = 20) Pageable pageable) {
        return ResponseEntity.ok(customerService.findAll(search, status, pageable));
    }

    @GetMapping("/{id}")
    @PreAuthorize("hasAuthority('customers.read')")
    @Operation(summary = "Get customer by ID")
    public ResponseEntity<CustomerDTO> getCustomerById(@PathVariable String id) {
        return ResponseEntity.ok(customerService.findById(id));
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    @PreAuthorize("hasAuthority('customers.create')")
    @Operation(summary = "Create a new customer")
    public ResponseEntity<CustomerDTO> createCustomer(@Valid @RequestBody CustomerDTO dto) {
        return ResponseEntity.status(HttpStatus.CREATED).body(customerService.create(dto));
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasAuthority('customers.update')")
    @Operation(summary = "Update customer")
    public ResponseEntity<CustomerDTO> updateCustomer(@PathVariable String id, @Valid @RequestBody CustomerDTO dto) {
        return ResponseEntity.ok(customerService.update(id, dto));
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasAuthority('customers.delete')")
    @Operation(summary = "Delete customer")
    public ResponseEntity<Void> deleteCustomer(@PathVariable String id) {
        customerService.delete(id);
        return ResponseEntity.noContent().build();
    }
}
