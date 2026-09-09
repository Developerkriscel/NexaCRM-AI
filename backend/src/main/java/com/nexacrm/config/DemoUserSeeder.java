package com.nexacrm.config;

import com.nexacrm.model.User;
import com.nexacrm.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.CommandLineRunner;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;

import java.util.Locale;
import java.util.Optional;

@Component
@RequiredArgsConstructor
@Slf4j
public class DemoUserSeeder implements CommandLineRunner {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;

    @Value("${nexacrm.bootstrap-demo-users.enabled:false}")
    private boolean enabled;

    @Value("${APP_ENV:development}")
    private String appEnv;

    @Value("${nexacrm.bootstrap-demo-users.password:demo1234}")
    private String demoPassword;

    @Value("${nexacrm.bootstrap-demo-users.reset-passwords:true}")
    private boolean resetPasswords;

    @Override
    public void run(String... args) {
        if (!shouldSeedDemoUsers()) {
            return;
        }

        String encodedPassword = passwordEncoder.encode(demoPassword);

        upsertUser("Aarav Joshi", "superadmin@nexacrm.com", User.Role.SUPER_ADMIN, "+91-98765-00000", true, encodedPassword);
        upsertUser("Nisha Kapoor", "companyadmin@nexacrm.com", User.Role.COMPANY_ADMIN, "+91-98765-00006", true, encodedPassword);
        upsertUser("Saurabh Kumar", "saurabhke4@gmail.com", User.Role.ADMIN, "+91-98765-00001", true, encodedPassword);
        upsertUser("Priya Sharma", "priya@nexacrm.com", User.Role.MANAGER, "+91-98765-00002", true, encodedPassword);
        upsertUser("Rahul Mehta", "rahul@nexacrm.com", User.Role.SALES_EXEC, "+91-98765-00003", true, encodedPassword);
        upsertUser("Amit Kumar", "amit@nexacrm.com", User.Role.SALES_EXEC, "+91-98765-00004", true, encodedPassword);
        upsertUser("Neha Singh", "neha@nexacrm.com", User.Role.SALES_EXEC, "+91-98765-00005", false, encodedPassword);
        upsertUser("Rohan Verma", "normaluser@nexacrm.com", User.Role.NORMAL_USER, "+91-98765-00007", true, encodedPassword);

        log.warn("Demo users bootstrapped with default password. Change passwords after first login.");
    }

    private boolean shouldSeedDemoUsers() {
        if (enabled) {
            return true;
        }
        return appEnv != null && ("development".equalsIgnoreCase(appEnv) || "dev".equalsIgnoreCase(appEnv));
    }

    private void upsertUser(String name, String email, User.Role role, String phone, boolean active, String encodedPassword) {
        String normalizedEmail = email.trim().toLowerCase(Locale.ROOT);
        Optional<User> existing = userRepository.findByEmailAndTenantIdAndDeletedFalse(normalizedEmail, 1L);

        User user = existing.orElseGet(() -> User.builder()
            .email(normalizedEmail)
            .build());

        user.setName(name);
        user.setRole(role);
        user.setPhone(phone);
        user.setIsActive(active);
        user.setTenantId(1L);
        user.setDeleted(false);

        if (resetPasswords || existing.isEmpty()) {
            user.setPassword(encodedPassword);
        }

        userRepository.save(user);

        if (existing.isPresent()) {
            log.info("Demo user updated: {}", normalizedEmail);
        } else {
            log.info("Demo user created: {}", normalizedEmail);
        }
    }
}
