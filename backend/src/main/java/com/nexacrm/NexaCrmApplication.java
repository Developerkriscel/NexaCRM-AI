package com.nexacrm;

import jakarta.annotation.PostConstruct;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.cache.annotation.EnableCaching;
import org.springframework.scheduling.annotation.EnableAsync;
import org.springframework.scheduling.annotation.EnableScheduling;

@SpringBootApplication
@EnableCaching
@EnableAsync
@EnableScheduling
public class NexaCrmApplication {

    private static final String INSECURE_JWT_PLACEHOLDER = "replace-with-a-64-char-minimum-secret-before-production";

    @Value("${jwt.secret}")
    private String jwtSecret;

    @Value("${auth.cookie.secure:true}")
    private boolean cookieSecure;

    @PostConstruct
    public void validateCriticalConfig() {
        if (INSECURE_JWT_PLACEHOLDER.equals(jwtSecret) || jwtSecret == null || jwtSecret.isBlank()) {
            throw new IllegalStateException(
                "FATAL: JWT_SECRET environment variable is not set or uses the insecure placeholder. " +
                "Set a random 64-character secret before starting the application.");
        }
        if (jwtSecret.length() < 32) {
            throw new IllegalStateException(
                "FATAL: JWT_SECRET is too short (minimum 32 characters required, 64 recommended).");
        }
        if (!cookieSecure) {
            // Warn but don't fail — allows local HTTP dev
            System.err.println("WARNING: auth.cookie.secure=false. Auth cookies will be sent over plain HTTP. " +
                "Set AUTH_COOKIE_SECURE=true in production.");
        }
    }

    public static void main(String[] args) {
        SpringApplication.run(NexaCrmApplication.class, args);
    }
}
