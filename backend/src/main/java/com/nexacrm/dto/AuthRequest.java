package com.nexacrm.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class AuthRequest {
    @Email
    @NotBlank
    private String email;

    @NotBlank
    private String password;

    /** @deprecated Tenant must be resolved from the user record in the database, not from client input. */
    @Deprecated
    private Long tenantId;
}
