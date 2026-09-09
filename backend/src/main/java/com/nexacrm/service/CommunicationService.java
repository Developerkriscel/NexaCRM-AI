package com.nexacrm.service;

import com.nexacrm.dto.EmailSendRequest;
import com.nexacrm.dto.WhatsAppConversationResponse;
import com.nexacrm.dto.WhatsAppMessageResponse;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.nexacrm.model.CommunicationRecord;
import com.nexacrm.repository.CommunicationRecordRepository;
import com.nexacrm.security.TenantContext;
import jakarta.mail.MessagingException;
import jakarta.mail.internet.MimeMessage;
import lombok.NonNull;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.PageRequest;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.mail.MailAuthenticationException;
import org.springframework.mail.MailSendException;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.MimeMessageHelper;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.client.HttpStatusCodeException;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.util.UriComponentsBuilder;

import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

@Service
@RequiredArgsConstructor
@Slf4j
public class CommunicationService {

    private static final TypeReference<Map<String, Object>> MAP_TYPE = new TypeReference<>() {};

    private final JavaMailSender mailSender;
    private final IntegrationService integrationService;
    private final CommunicationRecordRepository communicationRecordRepository;
    private final NotificationService notificationService;
    private final ObjectMapper objectMapper;
    private final RestTemplate restTemplate;
    private final Map<String, String> facebookNameCache = new ConcurrentHashMap<>();
    private final Map<String, String> instagramNameCache = new ConcurrentHashMap<>();

    @Value("${spring.mail.username}")
    private String smtpFrom;

    @Value("${spring.mail.host:}")
    private String smtpHost;

    @Value("${spring.mail.password:}")
    private String smtpPassword;

    @Value("${nexacrm.whatsapp.aiadrika-base-url:https://aiadrika.in/api/send}")
    private String aiadrikaBaseUrl;

    @Value("${nexacrm.whatsapp.aiadrika.instance-id:}")
    private String defaultInstanceId;

    @Value("${nexacrm.whatsapp.aiadrika.access-token:}")
    private String defaultAccessToken;

    @Value("${meta.page-access-token:}")
    private String defaultFacebookPageAccessToken;

    @Value("${meta.graph-api-version:v19.0}")
    private String metaGraphApiVersion;

    @Value("${meta.facebook.out-of-window.retry-with-message-tag:false}")
    private boolean retryFacebookOutOfWindowWithMessageTag;

    @Value("${meta.facebook.message-tag:HUMAN_AGENT}")
    private String facebookMessageTag;

    @Value("${nexacrm.auto-reply.enabled:true}")
    private boolean autoReplyEnabled;

    @Value("${nexacrm.auto-reply.message:Thanks for messaging NexaCRM! We received your message and will get back to you shortly.}")
    private String autoReplyMessage;

    @Value("${nexacrm.call-agent.enabled:false}")
    private boolean defaultCallAgentEnabled;

    @Value("${nexacrm.call-agent.auto-call-on-lead-create:false}")
    private boolean defaultAutoCallOnLeadCreate;

    @Value("${nexacrm.call-agent.webhook-url:}")
    private String defaultCallAgentWebhookUrl;

    @Value("${nexacrm.call-agent.api-key:}")
    private String defaultCallAgentApiKey;

    @Value("${nexacrm.call-agent.agent-id:}")
    private String defaultCallAgentAgentId;

    @Value("${nexacrm.call-agent.from-number:}")
    private String defaultCallAgentFromNumber;

    @Value("${nexacrm.call-agent.timeout-ms:12000}")
    private int callAgentTimeoutMs;

    @Value("${nexacrm.call-agent.provider:bolna}")
    private String defaultCallAgentProvider;

    private Long tenantId() {
        return TenantContext.currentTenantId();
    }

    @Value("${nexacrm.call-agent.bolna.api-url:https://api.bolna.ai}")
    private String defaultBolnaApiUrl;

    @Value("${nexacrm.call-agent.bolna.api-key:}")
    private String defaultBolnaApiKey;

    @Value("${nexacrm.call-agent.bolna.agent-id:}")
    private String defaultBolnaAgentId;

    @Value("${nexacrm.call-agent.bolna.voice-id:}")
    private String defaultBolnaVoiceId;

    @Value("${nexacrm.call-agent.callback-webhook-url:}")
    private String defaultCallAgentCallbackWebhookUrl;

    public void sendEmail(EmailSendRequest request) {
        validateSmtpConfiguration();
        try {
            MimeMessage message = mailSender.createMimeMessage();
            MimeMessageHelper helper = new MimeMessageHelper(message, false, "UTF-8");
            helper.setFrom(smtpFrom);
            helper.setTo(request.getTo().trim());
            helper.setSubject(request.getSubject().trim());
            helper.setText(request.getBody().trim(), false);
            mailSender.send(message);
            notifyOutboundCommunication(
                "email",
                request.getTo(),
                combineEmailPreview(request.getSubject(), request.getBody())
            );
            log.info("Email sent to {}", request.getTo());
        } catch (MailAuthenticationException ex) {
            log.error("SMTP authentication failed", ex);
            throw new IllegalStateException(
                "SMTP authentication failed. Verify you are using a current App Password generated for this same Gmail account."
            );
        } catch (MailSendException ex) {
            log.error("SMTP send failed: {}", ex.getMessage());
            throw new IllegalStateException("Failed to send email. Check recipient and SMTP settings.");
        } catch (MessagingException ex) {
            log.error("Email compose failed: {}", ex.getMessage());
            throw new IllegalStateException("Failed to compose email message.");
        }
    }

    private void validateSmtpConfiguration() {
        String host = trim(smtpHost).toLowerCase(Locale.ROOT);
        if (!host.contains("gmail.com")) {
            return;
        }

        String password = trim(smtpPassword).replace(" ", "");
        if (password.isBlank() || password.length() != 16) {
            throw new IllegalStateException(
                "Gmail SMTP requires a 16-character App Password. Current configured password length="
                    + password.length()
                    + ". Generate it in Google Account > Security > 2-Step Verification > App passwords."
            );
        }
    }

    public void sendChannelMessage(@NonNull String channel, @NonNull String recipient, String subject, @NonNull String body) {
        String normalizedChannel = channel.trim().toLowerCase(Locale.ROOT);
        switch (normalizedChannel) {
            case "email", "gmail" -> {
                EmailSendRequest emailRequest = new EmailSendRequest();
                emailRequest.setTo(recipient);
                emailRequest.setSubject(normalizeSubject(subject));
                emailRequest.setBody(body);
                sendEmail(emailRequest);
                tryPersistCommunication(
                    "EMAIL",
                    "OUT",
                    recipient,
                    body,
                    "SENT",
                    null,
                    "{\"subject\":\"" + normalizeSubject(subject).replace("\"", "\\\"") + "\"}",
                    "smtp"
                );
            }
            case "call", "voice", "voice_call" -> sendVoiceCall(
                resolveVoiceAgentConfig(),
                recipient,
                body,
                "manual_send",
                Map.of("channel", "call")
            );
            case "whatsapp", "instagram", "facebook", "linkedin", "reddit" -> sendSocialMessage(normalizedChannel, recipient, body);
            default -> throw new IllegalStateException("Unsupported channel: " + normalizedChannel);
        }
    }

    public void sendLeadVoiceCall(
        String leadId,
        String leadName,
        String leadPhone,
        String script,
        String triggerSource,
        Map<String, Object> metadata
    ) {
        Map<String, Object> mergedMetadata = new LinkedHashMap<>();
        if (metadata != null && !metadata.isEmpty()) {
            mergedMetadata.putAll(metadata);
        }
        if (!trim(leadId).isBlank()) {
            mergedMetadata.put("leadId", trim(leadId));
        }
        if (!trim(leadName).isBlank()) {
            mergedMetadata.put("leadName", trim(leadName));
        }
        sendVoiceCall(
            resolveVoiceAgentConfig(),
            leadPhone,
            script,
            trim(triggerSource).isBlank() ? "manual_lead_call" : triggerSource,
            mergedMetadata
        );
    }

    @Async
    public void autoCallNewLeadAsync(
        String leadId,
        String leadName,
        String leadPhone,
        String company,
        String service,
        String assignedToName
    ) {
        VoiceAgentConfig config = resolveVoiceAgentConfig();
        if (!config.enabled() || !config.autoCallOnLeadCreate()) {
            return;
        }
        if (trim(leadPhone).isBlank()) {
            log.info("Auto-call skipped for lead {} because phone number is missing", trim(leadId));
            return;
        }

        String script = buildLeadCallScript(leadName, company, service);
        Map<String, Object> metadata = new LinkedHashMap<>();
        metadata.put("leadId", trim(leadId));
        metadata.put("leadName", trim(leadName));
        metadata.put("company", trim(company));
        metadata.put("service", trim(service));
        metadata.put("assignedTo", trim(assignedToName));
        metadata.put("trigger", "LEAD_CREATED");

        try {
            sendLeadVoiceCall(leadId, leadName, leadPhone, script, "lead_auto_call", metadata);
            log.info("Auto-call queued for lead {}", trim(leadId));
        } catch (Exception ex) {
            log.warn("Auto-call failed for lead {}: {}", trim(leadId), ex.getMessage());
        }
    }

    public List<WhatsAppMessageResponse> getWhatsAppMessages(@NonNull String contact) {
        String normalizedContact = normalizeContact(contact);
        return communicationRecordRepository
            .findTop500ByTenantIdAndChannelIgnoreCaseAndContactIdentifierOrderByCreatedAtAsc(tenantId(), "WHATSAPP", normalizedContact)
            .stream()
            .map(this::toMessageResponse)
            .toList();
    }

    public List<WhatsAppConversationResponse> getWhatsAppConversations() {
        List<CommunicationRecord> rows = communicationRecordRepository.findByTenantIdAndChannelIgnoreCaseOrderByCreatedAtDesc(
            tenantId(),
            "WHATSAPP",
            PageRequest.of(0, 1000)
        );

        Map<String, CommunicationRecord> latestByContact = new LinkedHashMap<>();
        for (CommunicationRecord row : rows) {
            String contact = trim(row.getContactIdentifier());
            if (contact.isBlank()) {
                continue;
            }
            latestByContact.putIfAbsent(contact, row);
        }

        return latestByContact.values().stream()
            .map(row -> WhatsAppConversationResponse.builder()
                .contact(row.getContactIdentifier())
                .name(trim(row.getContactName()))
                .lastMessage(row.getBody())
                .lastDirection(row.getDirection())
                .lastAt(asUtcOffsetDateTime(row.getCreatedAt()))
                .build())
            .sorted(Comparator.comparing(
                (WhatsAppConversationResponse c) -> c.getLastAt() == null ? OffsetDateTime.MIN : c.getLastAt()
            ).reversed())
            .toList();
    }

    // ── Facebook Messenger ────────────────────────────────────────

    @Async
    public void processFacebookMessengerWebhookAsync(String rawBody) {
        try {
            JsonNode root = objectMapper.readTree(rawBody);
            JsonNode entries = root.path("entry");
            if (!entries.isArray()) return;

            int saved = 0;
            Map<String, String> localNameCache = new HashMap<>();
            for (JsonNode entry : entries) {
                JsonNode messaging = entry.path("messaging");
                if (!messaging.isArray()) continue;
                for (JsonNode event : messaging) {
                    String psid = trim(event.at("/sender/id").asText(""));
                    JsonNode msgNode = event.path("message");
                    if (psid.isBlank() || msgNode.isMissingNode()) continue;
                    if (msgNode.path("is_echo").asBoolean(false)) continue;

                    String text = trim(msgNode.path("text").asText(""));
                    String mid  = trim(msgNode.path("mid").asText(""));
                    if (text.isBlank()) continue;
                    if (isDuplicateInboundEvent("FACEBOOK", mid)) {
                        continue;
                    }
                    String displayName = localNameCache.computeIfAbsent(psid, this::resolveFacebookProfileName);

                    boolean persisted = tryPersistCommunication(
                        "FACEBOOK", "IN", psid, text, "RECEIVED", mid, toJson(event), "facebook_messenger", displayName
                    );
                    if (persisted) {
                        saved++;
                        notificationService.notifyInboundMessage("facebook", displayName, text);
                        sendAutoReplySafely("facebook", psid);
                    }
                }
            }
            log.info("Facebook Messenger webhook processed, inbound saved={}", saved);
        } catch (Exception e) {
            log.error("Error processing Facebook Messenger webhook", e);
        }
    }

    public List<WhatsAppMessageResponse> getFacebookMessages(String psid) {
        String normalizedPsid = psid == null ? "" : psid.trim().replaceAll("\\D", "");
        return communicationRecordRepository
            .findTop500ByTenantIdAndChannelIgnoreCaseAndContactIdentifierOrderByCreatedAtAsc(tenantId(), "FACEBOOK", normalizedPsid)
            .stream()
            .map(this::toMessageResponse)
            .toList();
    }

    public List<WhatsAppConversationResponse> getFacebookConversations() {
        List<CommunicationRecord> rows = communicationRecordRepository.findByTenantIdAndChannelIgnoreCaseOrderByCreatedAtDesc(
            tenantId(),
            "FACEBOOK", PageRequest.of(0, 1000)
        );

        Map<String, CommunicationRecord> latestByContact = new LinkedHashMap<>();
        for (CommunicationRecord row : rows) {
            String contact = trim(row.getContactIdentifier());
            if (contact.isBlank()) continue;
            latestByContact.putIfAbsent(contact, row);
        }

        return latestByContact.values().stream()
            .map(row -> WhatsAppConversationResponse.builder()
                .contact(row.getContactIdentifier())
                .name(resolveFacebookDisplayName(row))
                .lastMessage(row.getBody())
                .lastDirection(row.getDirection())
                .lastAt(asUtcOffsetDateTime(row.getCreatedAt()))
                .build())
            .sorted(Comparator.comparing(
                (WhatsAppConversationResponse c) -> c.getLastAt() == null ? OffsetDateTime.MIN : c.getLastAt()
            ).reversed())
            .toList();
    }

    // ── Instagram Messaging ──────────────────────────────────────

    @Async
    public void processInstagramMessengerWebhookAsync(String rawBody) {
        try {
            JsonNode root = objectMapper.readTree(rawBody);
            JsonNode entries = root.path("entry");
            if (!entries.isArray()) return;

            int saved = 0;
            for (JsonNode entry : entries) {
                JsonNode messaging = entry.path("messaging");
                if (!messaging.isArray()) continue;
                for (JsonNode event : messaging) {
                    String igsid = trim(event.at("/sender/id").asText(""));
                    JsonNode msgNode = event.path("message");
                    if (igsid.isBlank() || msgNode.isMissingNode()) continue;
                    if (msgNode.path("is_echo").asBoolean(false)) continue;

                    String text = trim(msgNode.path("text").asText(""));
                    String mid = trim(msgNode.path("mid").asText(""));
                    if (text.isBlank()) continue;
                    if (isDuplicateInboundEvent("INSTAGRAM", mid)) {
                        continue;
                    }

                    String displayName = extractInstagramDisplayName(event, igsid);
                    boolean persisted = tryPersistCommunication(
                        "INSTAGRAM",
                        "IN",
                        igsid,
                        text,
                        "RECEIVED",
                        mid,
                        toJson(event),
                        "instagram_messaging",
                        displayName
                    );
                    if (persisted) {
                        saved++;
                        notificationService.notifyInboundMessage("instagram", displayName, text);
                        sendAutoReplySafely("instagram", igsid);
                    }
                }
            }
            log.info("Instagram webhook processed, inbound saved={}", saved);
        } catch (Exception e) {
            log.error("Error processing Instagram webhook", e);
        }
    }

    public List<WhatsAppMessageResponse> getInstagramMessages(String igsid) {
        String normalizedIgsid = trim(igsid);
        return communicationRecordRepository
            .findTop500ByTenantIdAndChannelIgnoreCaseAndContactIdentifierOrderByCreatedAtAsc(tenantId(), "INSTAGRAM", normalizedIgsid)
            .stream()
            .map(this::toMessageResponse)
            .toList();
    }

    public List<WhatsAppConversationResponse> getInstagramConversations() {
        List<CommunicationRecord> rows = communicationRecordRepository.findByTenantIdAndChannelIgnoreCaseOrderByCreatedAtDesc(
            tenantId(),
            "INSTAGRAM",
            PageRequest.of(0, 1000)
        );

        Map<String, CommunicationRecord> latestByContact = new LinkedHashMap<>();
        for (CommunicationRecord row : rows) {
            String contact = trim(row.getContactIdentifier());
            if (contact.isBlank()) continue;
            latestByContact.putIfAbsent(contact, row);
        }

        return latestByContact.values().stream()
            .map(row -> WhatsAppConversationResponse.builder()
                .contact(row.getContactIdentifier())
                .name(resolveInstagramDisplayName(row))
                .lastMessage(row.getBody())
                .lastDirection(row.getDirection())
                .lastAt(asUtcOffsetDateTime(row.getCreatedAt()))
                .build())
            .sorted(Comparator.comparing(
                (WhatsAppConversationResponse c) -> c.getLastAt() == null ? OffsetDateTime.MIN : c.getLastAt()
            ).reversed())
            .toList();
    }

    public Map<String, Object> processWhatsAppWebhook(Map<String, Object> payload) {
        JsonNode root = objectMapper.valueToTree(payload);
        List<JsonNode> candidates = collectCandidates(root);
        int saved = 0;

        for (JsonNode candidate : candidates) {
            String contact = extractContact(candidate);
            String text = extractText(candidate);
            String direction = extractDirection(candidate);
            String externalId = extractExternalId(candidate);
            String status = extractStatus(candidate);

            if (contact.isBlank() || text.isBlank()) {
                continue;
            }
            if (!"IN".equals(direction)) {
                continue;
            }
            if (isDuplicateInboundEvent("WHATSAPP", externalId)) {
                continue;
            }

            boolean persisted = tryPersistCommunication(
                "WHATSAPP",
                direction,
                contact,
                text,
                status,
                externalId,
                toJson(candidate),
                "aiadrika"
            );
            if (persisted) {
                saved++;
                notificationService.notifyInboundMessage("whatsapp", contact, text);
                sendAutoReplySafely("whatsapp", contact);
            }
        }

        if (saved == 0) {
            log.info("WhatsApp webhook received, no inbound messages detected.");
        } else {
            log.info("WhatsApp webhook processed, inbound saved={}", saved);
        }

        return Map.of("ok", true, "saved", saved);
    }

    private void sendSocialMessage(String channel, String recipient, String body) {
        if ("whatsapp".equals(channel)) {
            sendViaAiadrikaWhatsApp(recipient, body);
            return;
        }

        if ("facebook".equals(channel)) {
            sendViaFacebookMessenger(recipient, body);
            return;
        }

        if ("instagram".equals(channel)) {
            sendViaInstagramMessaging(recipient, body);
            return;
        }

        if (!integrationService.isConnected(channel)) {
            throw new IllegalStateException("Connect " + channel + " in Integrations page first.");
        }

        log.info("Simulated {} send to {} with text length {}", channel, recipient, body.length());
        tryPersistCommunication(
            channel.toUpperCase(Locale.ROOT),
            "OUT",
            recipient,
            body,
            "SENT",
            null,
            "",
            channel
        );
        notifyOutboundCommunication(channel, recipient, body);
    }

    private void sendViaAiadrikaWhatsApp(String recipient, String body) {
        String number = recipient == null ? "" : recipient.replaceAll("\\D", "");
        if (number.isBlank()) {
            throw new IllegalStateException("Invalid WhatsApp number.");
        }

        Map<String, String> config = integrationService.getConfig("whatsapp");
        String instanceId = trim(config.get("instanceId"));
        String accessToken = trim(config.get("accessToken"));
        String configuredApiUrl = trim(config.get("apiUrl"));

        if (instanceId.isBlank()) {
            instanceId = trim(defaultInstanceId);
        }
        if (accessToken.isBlank()) {
            accessToken = trim(defaultAccessToken);
        }

        if (instanceId.isBlank() || accessToken.isBlank()) {
            throw new IllegalStateException("WhatsApp instance ID or access token is missing in backend config.");
        }

        String providerApiUrl = configuredApiUrl.isBlank() ? trim(aiadrikaBaseUrl) : configuredApiUrl;
        if (providerApiUrl.isBlank()) {
            throw new IllegalStateException("WhatsApp API URL is missing. Set apiUrl in Integrations or AIADRIKA_BASE_URL in backend env.");
        }

        String url = UriComponentsBuilder.fromHttpUrl(providerApiUrl)
            .queryParam("number", number)
            .queryParam("type", "text")
            .queryParam("message", body)
            .queryParam("instance_id", instanceId)
            .queryParam("access_token", accessToken)
            .build(true)
            .toUriString();

        try {
            String response = restTemplate.getForObject(url, String.class);
            String externalId = null;
            if (response != null && !response.isBlank()) {
                Map<String, Object> data = objectMapper.readValue(response, MAP_TYPE);
                Object status = data.get("status");
                if (status != null && "error".equalsIgnoreCase(String.valueOf(status))) {
                    String apiMessage = String.valueOf(data.getOrDefault("message", "Unknown error"));
                    throw new IllegalStateException("Aiadrika error: " + apiMessage);
                }
                externalId = extractExternalId(objectMapper.valueToTree(data));
            }
            tryPersistCommunication("WHATSAPP", "OUT", number, body, "SENT", externalId, response, "aiadrika");
            notifyOutboundCommunication("whatsapp", number, body);
            log.info("WhatsApp sent via Aiadrika to {}", number);
        } catch (IllegalStateException ex) {
            throw ex;
        } catch (Exception ex) {
            log.error("Aiadrika send failed: {}", ex.getMessage());
            throw new IllegalStateException("Failed to send WhatsApp message via Aiadrika.");
        }
    }

    private void sendViaFacebookMessenger(String recipient, String body) {
        String psid = recipient == null ? "" : recipient.replaceAll("\\D", "");
        if (psid.isBlank()) {
            throw new IllegalStateException("Invalid Facebook PSID.");
        }

        Map<String, String> config = integrationService.getConfig("facebook");
        String accessToken = trim(config.get("accessToken"));
        if (accessToken.isBlank()) {
            accessToken = trim(defaultFacebookPageAccessToken);
        }
        if (accessToken.isBlank()) {
            throw new IllegalStateException("Facebook Page access token is missing in Integrations or backend config.");
        }

        String pageId = trim(config.get("pageId"));
        String pageNode = pageId.isBlank() ? "me" : pageId;

        String url = buildFacebookMessagesUrl(accessToken, pageNode);
        String meUrl = buildFacebookMessagesUrl(accessToken, "me");

        Map<String, Object> responsePayload = Map.of(
            "recipient", Map.of("id", psid),
            "messaging_type", "RESPONSE",
            "message", Map.of("text", body)
        );

        try {
            log.info(
                "Facebook send attempt: pageNode={}, psid={}, endpoint={}",
                pageNode,
                psid,
                url
            );
            @SuppressWarnings("unchecked")
            Map<String, Object> response = restTemplate.postForObject(url, responsePayload, Map.class);
            persistFacebookSend(psid, body, response);
            log.info("Facebook message sent to PSID {}", psid);
        } catch (HttpStatusCodeException ex) {
            String apiBody = trim(ex.getResponseBodyAsString());
            log.error(
                "Facebook send failed: pageNode={}, psid={}, endpoint={}, status={}, body={}",
                pageNode,
                psid,
                url,
                ex.getStatusCode(),
                apiBody
            );

            if (shouldRetryFacebookSendWithMeEndpoint(apiBody, pageNode)) {
                try {
                    log.warn(
                        "Facebook send fallback triggered: original_pageNode={}, psid={}, fallback_endpoint={}",
                        pageNode,
                        psid,
                        meUrl
                    );
                    @SuppressWarnings("unchecked")
                    Map<String, Object> meResponse = restTemplate.postForObject(meUrl, responsePayload, Map.class);
                    persistFacebookSend(psid, body, meResponse);
                    log.info("Facebook message sent to PSID {} using /me/messages fallback", psid);
                    return;
                } catch (HttpStatusCodeException meEx) {
                    String meApiBody = trim(meEx.getResponseBodyAsString());
                    log.error(
                        "Facebook /me/messages fallback failed: original_pageNode={}, psid={}, fallback_endpoint={}, status={}, body={}",
                        pageNode,
                        psid,
                        meUrl,
                        meEx.getStatusCode(),
                        meApiBody
                    );
                }
            }

            if (isOutsideFacebookMessagingWindow(apiBody)) {
                if (retryFacebookOutOfWindowWithMessageTag) {
                    String tag = normalizeFacebookMessageTag(facebookMessageTag);
                    Map<String, Object> taggedPayload = Map.of(
                        "recipient", Map.of("id", psid),
                        "messaging_type", "MESSAGE_TAG",
                        "tag", tag,
                        "message", Map.of("text", body)
                    );
                    try {
                        @SuppressWarnings("unchecked")
                        Map<String, Object> taggedResponse = restTemplate.postForObject(url, taggedPayload, Map.class);
                        persistFacebookSend(psid, body, taggedResponse);
                        log.info("Facebook message sent to PSID {} with MESSAGE_TAG {}", psid, tag);
                        return;
                    } catch (HttpStatusCodeException tagEx) {
                        String taggedApiBody = trim(tagEx.getResponseBodyAsString());
                        log.error(
                            "Facebook MESSAGE_TAG send failed: status={}, tag={}, body={}",
                            tagEx.getStatusCode(),
                            tag,
                            taggedApiBody
                        );
                        throw new IllegalStateException(
                            "Facebook rejected the message outside the 24-hour window. "
                                + "Retry with MESSAGE_TAG also failed. "
                                + "Use an allowed tag/use-case or wait for user re-engagement."
                        );
                    } catch (Exception tagEx) {
                        log.error("Facebook MESSAGE_TAG send failed: {}", tagEx.getMessage(), tagEx);
                        throw new IllegalStateException(
                            "Facebook rejected the message outside the 24-hour window and tag retry failed."
                        );
                    }
                }

                throw new IllegalStateException(
                    "Facebook Messenger 24-hour policy blocked this send. "
                        + "Ask the contact to message your Page first, or enable message-tag retry in backend config for valid non-promotional use cases."
                );
            }

            throw new IllegalStateException(
                apiBody.isBlank()
                    ? "Failed to send Facebook message."
                    : "Facebook send failed: " + apiBody
            );
        } catch (Exception ex) {
            log.error(
                "Facebook send failed with exception: pageNode={}, psid={}, endpoint={}, message={}",
                pageNode,
                psid,
                url,
                ex.getMessage(),
                ex
            );
            throw new IllegalStateException("Failed to send Facebook message.");
        }
    }

    private void persistFacebookSend(String psid, String body, Map<String, Object> response) {
        String externalId = "";
        if (response != null && response.get("message_id") != null) {
            externalId = String.valueOf(response.get("message_id"));
        }
        String rawPayload = response == null ? "" : toJson(objectMapper.valueToTree(response));
        String displayName = resolveFacebookProfileName(psid);
        tryPersistCommunication(
            "FACEBOOK",
            "OUT",
            psid,
            body,
            "SENT",
            externalId,
            rawPayload,
            "facebook_messenger",
            displayName
        );
        notifyOutboundCommunication("facebook", psid, body);
    }

    private boolean isOutsideFacebookMessagingWindow(String apiBody) {
        String normalized = trim(apiBody).toLowerCase(Locale.ROOT);
        return normalized.contains("outside the allowed window")
            || (normalized.contains("\"code\":10") && normalized.contains("messenger-platform/policy-overview"));
    }

    private boolean shouldRetryFacebookSendWithMeEndpoint(String apiBody, String pageNode) {
        if ("me".equalsIgnoreCase(trim(pageNode))) {
            return false;
        }
        String normalized = trim(apiBody).toLowerCase(Locale.ROOT);
        return normalized.contains("\"code\":1")
            || (normalized.contains("unsupported post request") && normalized.contains("object with id"));
    }

    private String buildFacebookMessagesUrl(String accessToken, String pageNode) {
        return UriComponentsBuilder
            .fromHttpUrl("https://graph.facebook.com/{version}/{pageNode}/messages")
            .queryParam("access_token", accessToken)
            .buildAndExpand(metaGraphApiVersion, pageNode)
            .toUriString();
    }

    private String normalizeFacebookMessageTag(String tag) {
        String normalized = trim(tag).toUpperCase(Locale.ROOT).replace('-', '_').replace(' ', '_');
        return normalized.isBlank() ? "HUMAN_AGENT" : normalized;
    }

    private void sendViaInstagramMessaging(String recipient, String body) {
        String igsid = trim(recipient);
        if (igsid.isBlank()) {
            throw new IllegalStateException("Invalid Instagram recipient ID.");
        }

        Map<String, String> instagramConfig = integrationService.getConfig("instagram");
        String igAccountId = trim(instagramConfig.get("igAccountId"));
        String accessToken = trim(instagramConfig.get("accessToken"));

        if (accessToken.isBlank()) {
            accessToken = trim(defaultFacebookPageAccessToken);
        }
        if (igAccountId.isBlank()) {
            throw new IllegalStateException("Instagram Account ID is missing in Integrations.");
        }
        if (accessToken.isBlank()) {
            throw new IllegalStateException("Instagram access token is missing in Integrations or backend config.");
        }

        String url = UriComponentsBuilder
            .fromHttpUrl("https://graph.facebook.com/{version}/{igAccountId}/messages")
            .queryParam("access_token", accessToken)
            .buildAndExpand(metaGraphApiVersion, igAccountId)
            .toUriString();

        Map<String, Object> payload = Map.of(
            "recipient", Map.of("id", igsid),
            "messaging_type", "RESPONSE",
            "message", Map.of("text", body)
        );

        try {
            @SuppressWarnings("unchecked")
            Map<String, Object> response = restTemplate.postForObject(url, payload, Map.class);
            String externalId = "";
            if (response != null && response.get("message_id") != null) {
                externalId = String.valueOf(response.get("message_id"));
            }
            String rawPayload = response == null ? "" : toJson(objectMapper.valueToTree(response));
            String displayName = instagramNameCache.getOrDefault(igsid, "");
            tryPersistCommunication(
                "INSTAGRAM",
                "OUT",
                igsid,
                body,
                "SENT",
                externalId,
                rawPayload,
                "instagram_messaging",
                displayName
            );
            notifyOutboundCommunication("instagram", igsid, body);
            log.info("Instagram message sent to IGSID {}", igsid);
        } catch (HttpStatusCodeException ex) {
            String apiBody = trim(ex.getResponseBodyAsString());
            log.error("Instagram send failed: status={}, body={}", ex.getStatusCode(), apiBody);
            throw new IllegalStateException(
                apiBody.isBlank()
                    ? "Failed to send Instagram message."
                    : "Instagram send failed: " + apiBody
            );
        } catch (Exception ex) {
            log.error("Instagram send failed: {}", ex.getMessage(), ex);
            throw new IllegalStateException("Failed to send Instagram message.");
        }
    }

    private void sendVoiceCall(
        VoiceAgentConfig config,
        String recipient,
        String script,
        String triggerSource,
        Map<String, Object> metadata
    ) {
        if (!config.enabled()) {
            throw new IllegalStateException("Voice call agent is disabled.");
        }
        String normalizedPhone = normalizePhoneForCall(recipient);
        if (normalizedPhone.isBlank()) {
            throw new IllegalStateException("Invalid phone number for voice call.");
        }

        String callScript = trim(script);
        if (callScript.isBlank()) {
            callScript = "Hello, this is NexaCRM. We are calling to follow up on your enquiry.";
        }

        String leadId = extractLeadId(metadata);
        String leadName = extractLeadName(metadata);

        String provider = trim(config.provider()).toLowerCase(Locale.ROOT);
        if ("webhook".equals(provider)) {
            queueWebhookCall(config, normalizedPhone, callScript, triggerSource, metadata, leadId, leadName);
            return;
        }
        queueBolnaCall(config, normalizedPhone, callScript, triggerSource, metadata, leadId, leadName);
    }

    private void queueWebhookCall(
        VoiceAgentConfig config,
        String normalizedPhone,
        String callScript,
        String triggerSource,
        Map<String, Object> metadata,
        String leadId,
        String leadName
    ) {
        if (config.webhookUrl().isBlank()) {
            throw new IllegalStateException("Voice call webhook URL is missing.");
        }

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        if (!config.apiKey().isBlank()) {
            headers.setBearerAuth(config.apiKey());
        }

        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("to", normalizedPhone);
        payload.put("script", callScript);
        payload.put("triggerSource", trim(triggerSource));
        payload.put("provider", "nexacrm_voice_call_agent");
        payload.put("timeoutMs", Math.max(3000, callAgentTimeoutMs));
        if (!config.fromNumber().isBlank()) {
            payload.put("from", config.fromNumber());
        }
        if (!config.agentId().isBlank()) {
            payload.put("agentId", config.agentId());
        }
        if (metadata != null && !metadata.isEmpty()) {
            payload.put("metadata", metadata);
        }

        try {
            ResponseEntity<String> response = restTemplate.exchange(
                config.webhookUrl(),
                HttpMethod.POST,
                new HttpEntity<>(payload, headers),
                String.class
            );

            String responseBody = trim(response.getBody());
            String externalId = extractExternalIdFromRawResponse(responseBody);
            String status = response.getStatusCode().is2xxSuccessful() ? "QUEUED" : "FAILED";
            boolean persisted = tryPersistCommunication(
                "CALL",
                "OUT",
                normalizedPhone,
                callScript,
                status,
                externalId,
                responseBody,
                "voice_call_agent",
                leadName,
                leadId
            );
            if (!persisted) {
                log.warn("Could not persist CALL communication for {}", normalizedPhone);
            }

            if (!response.getStatusCode().is2xxSuccessful()) {
                throw new IllegalStateException("Voice call provider returned status " + response.getStatusCode().value());
            }
        } catch (HttpStatusCodeException ex) {
            String apiBody = trim(ex.getResponseBodyAsString());
            tryPersistCommunication(
                "CALL",
                "OUT",
                normalizedPhone,
                callScript,
                "FAILED",
                "",
                apiBody,
                "voice_call_agent",
                leadName,
                leadId
            );
            throw new IllegalStateException(
                apiBody.isBlank()
                    ? "Failed to queue voice call."
                    : "Voice call provider error: " + apiBody
            );
        } catch (Exception ex) {
            throw new IllegalStateException("Failed to queue voice call.");
        }
    }

    private void queueBolnaCall(
        VoiceAgentConfig config,
        String normalizedPhone,
        String callScript,
        String triggerSource,
        Map<String, Object> metadata,
        String leadId,
        String leadName
    ) {
        String bolnaCallApiUrl = resolveBolnaCallApiUrl(config.bolnaApiUrl());
        String bolnaApiKey = firstNonBlank(config.bolnaApiKey(), config.apiKey());
        String bolnaAgentId = firstNonBlank(config.bolnaAgentId(), config.agentId());

        if (bolnaApiKey.isBlank()) {
            throw new IllegalStateException("Bolna API key is missing.");
        }
        if (bolnaAgentId.isBlank()) {
            throw new IllegalStateException("Bolna agent ID is missing.");
        }

        Map<String, Object> userData = new LinkedHashMap<>();
        if (!trim(leadId).isBlank()) {
            userData.put("lead_id", trim(leadId));
        }
        if (!trim(leadName).isBlank()) {
            userData.put("lead_name", trim(leadName));
        }
        userData.put("trigger_source", trim(triggerSource));
        userData.put("call_script", callScript);
        String callbackWebhookUrl = resolveCallAgentWebhookUrl(config);
        if (!callbackWebhookUrl.isBlank()) {
            userData.put("callback_webhook_url", callbackWebhookUrl);
        }
        if (!config.webhookSecret().isBlank()) {
            userData.put("callback_webhook_secret", config.webhookSecret());
        }
        if (metadata != null && !metadata.isEmpty()) {
            userData.put("metadata", metadata);
        }

        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("agent_id", bolnaAgentId);
        payload.put("recipient_phone_number", normalizedPhone);
        if (!config.fromNumber().isBlank()) {
            payload.put("from_phone_number", config.fromNumber());
        }
        if (!userData.isEmpty()) {
            payload.put("user_data", userData);
        }
        String voiceId = trim(config.bolnaVoiceId());
        if (!voiceId.isBlank()) {
            payload.put("agent_data", Map.of("voice_id", voiceId));
        }

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        headers.setBearerAuth(bolnaApiKey);

        try {
            ResponseEntity<String> response = restTemplate.exchange(
                bolnaCallApiUrl,
                HttpMethod.POST,
                new HttpEntity<>(payload, headers),
                String.class
            );

            String responseBody = trim(response.getBody());
            String externalId = extractExternalIdFromRawResponse(responseBody);
            if (externalId.isBlank()) {
                externalId = extractExternalIdFromMap(readJsonMap(responseBody));
            }

            Map<String, Object> raw = new LinkedHashMap<>();
            raw.put("provider", "bolna");
            raw.put("request", payload);
            raw.put("response", readJsonObject(responseBody));

            boolean persisted = tryPersistCommunication(
                "CALL",
                "OUT",
                normalizedPhone,
                callScript,
                response.getStatusCode().is2xxSuccessful() ? "QUEUED" : "FAILED",
                externalId,
                toJsonSafe(raw),
                "bolna",
                leadName,
                leadId
            );
            if (!persisted) {
                log.warn("Could not persist Bolna CALL communication for {}", normalizedPhone);
            }

            if (!response.getStatusCode().is2xxSuccessful()) {
                throw new IllegalStateException("Bolna call API returned status " + response.getStatusCode().value());
            }
        } catch (HttpStatusCodeException ex) {
            String apiBody = trim(ex.getResponseBodyAsString());
            tryPersistCommunication(
                "CALL",
                "OUT",
                normalizedPhone,
                callScript,
                "FAILED",
                "",
                apiBody,
                "bolna",
                leadName,
                leadId
            );
            throw new IllegalStateException(
                apiBody.isBlank()
                    ? "Failed to queue Bolna call."
                    : "Bolna error: " + apiBody
            );
        } catch (Exception ex) {
            throw new IllegalStateException("Failed to queue Bolna call.");
        }
    }

    private Map<String, Object> readJsonMap(String value) {
        if (trim(value).isBlank()) {
            return Map.of();
        }
        try {
            return objectMapper.readValue(value, MAP_TYPE);
        } catch (Exception ignored) {
            return Map.of();
        }
    }

    private String resolveCallAgentWebhookUrl(VoiceAgentConfig config) {
        String candidate = firstNonBlank(
            config.callbackWebhookUrl(),
            config.webhookUrl()
        );
        if (!candidate.isBlank()) {
            return candidate;
        }
        return "http://localhost:8080/api/calls/webhook";
    }

    private String resolveBolnaCallApiUrl(String value) {
        String normalized = trim(value);
        if (normalized.isBlank()) {
            normalized = "https://api.bolna.ai";
        } else if (!normalized.startsWith("https://") && !normalized.startsWith("http://")) {
            normalized = "https://" + normalized;
        }
        while (normalized.endsWith("/")) {
            normalized = normalized.substring(0, normalized.length() - 1);
        }
        if (normalized.endsWith("/call")) {
            return normalized;
        }
        return normalized + "/call";
    }

    private String toJsonSafe(Object value) {
        if (value == null) {
            return "";
        }
        try {
            return objectMapper.writeValueAsString(value);
        } catch (Exception ignored) {
            return "";
        }
    }

    private Object readJsonObject(String value) {
        try {
            if (trim(value).isBlank()) {
                return Map.of();
            }
            return objectMapper.readValue(value, Object.class);
        } catch (Exception ignored) {
            return trim(value);
        }
    }

    private VoiceAgentConfig resolveVoiceAgentConfig() {
        Map<String, String> config = integrationService.getConfig("voice_call_agent");
        String provider = firstNonBlank(config.get("provider"), defaultCallAgentProvider, "bolna").toLowerCase(Locale.ROOT);
        boolean enabled = parseBooleanFlag(firstNonBlank(config.get("enabled"), String.valueOf(defaultCallAgentEnabled)));
        boolean autoCallOnLeadCreate = parseBooleanFlag(
            firstNonBlank(config.get("autoCallOnLeadCreate"), String.valueOf(defaultAutoCallOnLeadCreate))
        );
        String webhookUrl = firstNonBlank(config.get("webhookUrl"), defaultCallAgentWebhookUrl);
        String apiKey = firstNonBlank(config.get("apiKey"), defaultCallAgentApiKey);
        String agentId = firstNonBlank(config.get("agentId"), defaultCallAgentAgentId);
        String fromNumber = firstNonBlank(config.get("fromNumber"), defaultCallAgentFromNumber);
        String webhookSecret = trim(config.get("webhookSecret"));
        String callbackWebhookUrl = firstNonBlank(config.get("callbackWebhookUrl"), defaultCallAgentCallbackWebhookUrl);
        String bolnaApiUrl = firstNonBlank(config.get("bolnaApiUrl"), defaultBolnaApiUrl);
        String bolnaApiKey = firstNonBlank(config.get("bolnaApiKey"), defaultBolnaApiKey);
        String bolnaAgentId = firstNonBlank(config.get("bolnaAgentId"), defaultBolnaAgentId);
        String bolnaVoiceId = firstNonBlank(config.get("bolnaVoiceId"), defaultBolnaVoiceId);
        return new VoiceAgentConfig(
            enabled,
            autoCallOnLeadCreate,
            provider,
            webhookUrl,
            apiKey,
            agentId,
            fromNumber,
            webhookSecret,
            callbackWebhookUrl,
            bolnaApiUrl,
            bolnaApiKey,
            bolnaAgentId,
            bolnaVoiceId
        );
    }

    private String buildLeadCallScript(String leadName, String company, String service) {
        Map<String, String> providerConfig = integrationService.getConfig("voice_call_agent");
        String template = trim(providerConfig.get("scriptTemplate"));
        if (template.isBlank()) {
            template = "Hi {leadName}, this is {agentName} from NexaCRM. We are calling regarding your enquiry{serviceSnippet}. Is now a good time to talk?";
        }

        String safeLeadName = trim(leadName).isBlank() ? "there" : trim(leadName);
        String safeAgentName = trim(providerConfig.get("agentName")).isBlank() ? "our team" : trim(providerConfig.get("agentName"));
        String safeService = trim(service);
        String safeCompany = trim(company);
        String serviceSnippet = safeService.isBlank() ? "" : " for " + safeService;

        return template
            .replace("{leadName}", safeLeadName)
            .replace("{agentName}", safeAgentName)
            .replace("{company}", safeCompany)
            .replace("{service}", safeService)
            .replace("{serviceSnippet}", serviceSnippet);
    }

    private String extractExternalIdFromRawResponse(String responseBody) {
        if (trim(responseBody).isBlank()) {
            return "";
        }
        try {
            String fromJsonNode = extractExternalId(objectMapper.readTree(responseBody));
            if (!fromJsonNode.isBlank()) {
                return fromJsonNode;
            }
            return extractExternalIdFromMap(readJsonMap(responseBody));
        } catch (Exception ex) {
            return "";
        }
    }

    private String extractExternalIdFromMap(Map<String, Object> payload) {
        if (payload == null || payload.isEmpty()) {
            return "";
        }
        return firstNonBlank(
            asText(payload.get("execution_id")),
            asText(payload.get("executionId")),
            asText(payload.get("call_id")),
            asText(payload.get("callId")),
            asText(payload.get("externalId")),
            asText(payload.get("id"))
        );
    }

    private String normalizePhoneForCall(String raw) {
        String value = trim(raw);
        if (value.isBlank()) {
            return "";
        }
        boolean hasPlus = value.startsWith("+");
        String digits = value.replaceAll("\\D", "");
        if (digits.isBlank()) {
            return "";
        }
        if (hasPlus) {
            return "+" + digits;
        }
        if (digits.length() == 10) {
            return "+91" + digits;
        }
        if (digits.startsWith("91") && digits.length() == 12) {
            return "+" + digits;
        }
        return "+" + digits;
    }

    private String extractLeadId(Map<String, Object> metadata) {
        if (metadata == null || metadata.isEmpty()) {
            return "";
        }
        Object value = metadata.get("leadId");
        if (value == null) {
            value = metadata.get("lead_id");
        }
        return trim(value == null ? "" : String.valueOf(value));
    }

    private String extractLeadName(Map<String, Object> metadata) {
        if (metadata == null || metadata.isEmpty()) {
            return "";
        }
        Object value = metadata.get("leadName");
        if (value == null) {
            value = metadata.get("lead_name");
        }
        return trim(value == null ? "" : String.valueOf(value));
    }

    private boolean parseBooleanFlag(String raw) {
        String normalized = trim(raw).toLowerCase(Locale.ROOT);
        return "true".equals(normalized)
            || "1".equals(normalized)
            || "yes".equals(normalized)
            || "on".equals(normalized)
            || "enabled".equals(normalized);
    }

    private String firstNonBlank(String... values) {
        for (String value : values) {
            String normalized = trim(value);
            if (!normalized.isBlank()) {
                return normalized;
            }
        }
        return "";
    }

    private String normalizeSubject(String subject) {
        String normalized = subject == null ? "" : subject.trim();
        return normalized.isBlank() ? "NexaCRM message" : normalized;
    }

    private boolean isDuplicateInboundEvent(String channel, String externalId) {
        String normalizedExternalId = trim(externalId);
        if (normalizedExternalId.isBlank()) {
            return false;
        }
        try {
            boolean duplicate = communicationRecordRepository.existsByTenantIdAndChannelIgnoreCaseAndExternalId(
                tenantId(),
                channel,
                normalizedExternalId
            );
            if (duplicate) {
                log.debug("Duplicate inbound {} event skipped for externalId={}", channel, normalizedExternalId);
            }
            return duplicate;
        } catch (Exception ex) {
            log.warn("Duplicate check failed for {} externalId={}: {}", channel, normalizedExternalId, ex.getMessage());
            return false;
        }
    }

    private void sendAutoReplySafely(String channel, String recipient) {
        if (!autoReplyEnabled) {
            return;
        }
        String replyText = trim(autoReplyMessage);
        if (replyText.isBlank()) {
            return;
        }
        try {
            sendSocialMessage(channel, recipient, replyText);
            log.info("Auto-reply sent on {} to {}", channel, recipient);
        } catch (Exception ex) {
            log.warn("Auto-reply failed on {} to {}: {}", channel, recipient, ex.getMessage());
        }
    }

    private String trim(String value) {
        return value == null ? "" : value.trim();
    }

    private void persistCommunication(
        String channel,
        String direction,
        String contactIdentifier,
        String body,
        String status,
        String externalId,
        String rawPayload,
        String provider
    ) {
        persistCommunication(channel, direction, contactIdentifier, body, status, externalId, rawPayload, provider, null, null);
    }

    private void persistCommunication(
        String channel,
        String direction,
        String contactIdentifier,
        String body,
        String status,
        String externalId,
        String rawPayload,
        String provider,
        String contactName
    ) {
        persistCommunication(channel, direction, contactIdentifier, body, status, externalId, rawPayload, provider, contactName, null);
    }

    private void persistCommunication(
        String channel,
        String direction,
        String contactIdentifier,
        String body,
        String status,
        String externalId,
        String rawPayload,
        String provider,
        String contactName,
        String leadId
    ) {
        CommunicationRecord record = new CommunicationRecord();
        record.setTenantId(1L);
        record.setChannel(channel);
        record.setDirection(direction);
        record.setBody(body);
        record.setStatus(trim(status).isBlank() ? "SENT" : trim(status).toUpperCase(Locale.ROOT));
        record.setExternalId(trim(externalId));
        String normalizedChannel = trim(channel).toUpperCase(Locale.ROOT);
        if ("WHATSAPP".equals(normalizedChannel) || "FACEBOOK".equals(normalizedChannel)) {
            record.setContactIdentifier(normalizeContact(contactIdentifier));
        } else {
            record.setContactIdentifier(trim(contactIdentifier));
        }
        String normalizedName = trim(contactName);
        if (!normalizedName.isBlank()) {
            record.setContactName(normalizedName);
        }
        record.setProvider(provider);
        record.setRawPayload(rawPayload);
        String normalizedLeadId = trim(leadId);
        if (!normalizedLeadId.isBlank()) {
            record.setLeadId(normalizedLeadId);
        }
        record.setCreatedAt(Instant.now());
        communicationRecordRepository.save(record);
    }

    private boolean tryPersistCommunication(
        String channel,
        String direction,
        String contactIdentifier,
        String body,
        String status,
        String externalId,
        String rawPayload,
        String provider
    ) {
        return tryPersistCommunication(channel, direction, contactIdentifier, body, status, externalId, rawPayload, provider, null, null);
    }

    private boolean tryPersistCommunication(
        String channel,
        String direction,
        String contactIdentifier,
        String body,
        String status,
        String externalId,
        String rawPayload,
        String provider,
        String contactName
    ) {
        return tryPersistCommunication(
            channel,
            direction,
            contactIdentifier,
            body,
            status,
            externalId,
            rawPayload,
            provider,
            contactName,
            null
        );
    }

    private boolean tryPersistCommunication(
        String channel,
        String direction,
        String contactIdentifier,
        String body,
        String status,
        String externalId,
        String rawPayload,
        String provider,
        String contactName,
        String leadId
    ) {
        try {
            persistCommunication(channel, direction, contactIdentifier, body, status, externalId, rawPayload, provider, contactName, leadId);
            return true;
        } catch (Exception ex) {
            log.warn(
                "Communication persistence failed for {} {}: {}",
                channel,
                contactIdentifier,
                ex.getMessage(),
                ex
            );
            return false;
        }
    }

    private void notifyOutboundCommunication(String channel, String recipient, String body) {
        try {
            notificationService.notifyOutboundMessage(channel, recipient, body);
        } catch (Exception ex) {
            log.warn("Outbound notification failed for {} {}: {}", channel, recipient, ex.getMessage());
        }
    }

    private String combineEmailPreview(String subject, String body) {
        String trimmedSubject = trim(subject);
        String trimmedBody = trim(body);
        if (trimmedSubject.isBlank()) {
            return trimmedBody;
        }
        if (trimmedBody.isBlank()) {
            return trimmedSubject;
        }
        return trimmedSubject + " — " + trimmedBody;
    }

    private WhatsAppMessageResponse toMessageResponse(CommunicationRecord row) {
        return WhatsAppMessageResponse.builder()
            .id(row.getId())
            .contact(row.getContactIdentifier())
            .direction(row.getDirection())
            .body(row.getBody())
            .status(row.getStatus())
            .externalId(row.getExternalId())
            .createdAt(asUtcOffsetDateTime(row.getCreatedAt()))
            .build();
    }

    private OffsetDateTime asUtcOffsetDateTime(Instant timestamp) {
        return timestamp == null ? null : timestamp.atOffset(ZoneOffset.UTC);
    }

    private String resolveFacebookDisplayName(CommunicationRecord row) {
        String existing = trim(row.getContactName());
        if (!existing.isBlank()) {
            return existing;
        }
        String psid = trim(row.getContactIdentifier());
        String resolved = resolveFacebookProfileName(psid);
        return resolved.isBlank() ? "PSID: " + psid : resolved;
    }

    private String resolveFacebookProfileName(String psidRaw) {
        String psid = psidRaw == null ? "" : psidRaw.replaceAll("\\D", "");
        if (psid.isBlank()) {
            return "";
        }
        String cached = trim(facebookNameCache.get(psid));
        if (!cached.isBlank()) {
            return cached;
        }

        String accessToken = trim(integrationService.getConfig("facebook").get("accessToken"));
        if (accessToken.isBlank()) {
            accessToken = trim(defaultFacebookPageAccessToken);
        }
        if (accessToken.isBlank()) {
            return "";
        }

        try {
            String url = UriComponentsBuilder
                .fromHttpUrl("https://graph.facebook.com/{version}/{psid}")
                .queryParam("fields", "name,first_name,last_name")
                .queryParam("access_token", accessToken)
                .buildAndExpand(metaGraphApiVersion, psid)
                .toUriString();
            @SuppressWarnings("unchecked")
            Map<String, Object> profile = restTemplate.getForObject(url, Map.class);
            if (profile == null) return "";

            String name = trim(asText(profile.get("name")));
            if (name.isBlank()) {
                String first = trim(asText(profile.get("first_name")));
                String last = trim(asText(profile.get("last_name")));
                name = trim((first + " " + last).trim());
            }

            if (!name.isBlank()) {
                facebookNameCache.put(psid, name);
            }
            return name;
        } catch (Exception ex) {
            log.debug("Could not resolve Facebook profile name for PSID {}: {}", psid, ex.getMessage());
            return "";
        }
    }

    private String resolveInstagramDisplayName(CommunicationRecord row) {
        String existing = trim(row.getContactName());
        if (!existing.isBlank()) {
            return existing;
        }
        String igsid = trim(row.getContactIdentifier());
        String cached = trim(instagramNameCache.get(igsid));
        if (!cached.isBlank()) {
            return cached;
        }
        return "IG: " + igsid;
    }

    private String extractInstagramDisplayName(JsonNode event, String igsid) {
        String[] options = {
            event.at("/sender/username").asText(""),
            event.at("/sender/name").asText(""),
            event.at("/sender/profile_name").asText("")
        };
        for (String option : options) {
            String value = trim(option);
            if (!value.isBlank()) {
                instagramNameCache.put(igsid, value);
                return value;
            }
        }
        return trim(instagramNameCache.getOrDefault(igsid, ""));
    }

    private String asText(Object value) {
        return value == null ? "" : String.valueOf(value);
    }

    private List<JsonNode> collectCandidates(JsonNode root) {
        List<JsonNode> candidates = new ArrayList<>();

        JsonNode messages = root.path("messages");
        if (messages.isArray()) {
            messages.forEach(candidates::add);
        }

        JsonNode data = root.path("data");
        if (data.isArray()) {
            data.forEach(candidates::add);
        } else if (data.isObject()) {
            candidates.add(data);
        }

        JsonNode message = root.path("message");
        if (message.isArray()) {
            message.forEach(candidates::add);
        } else if (message.isObject()) {
            candidates.add(message);
        }

        if (candidates.isEmpty()) {
            candidates.add(root);
        }
        return candidates;
    }

    private String extractDirection(JsonNode node) {
        JsonNode direction = node.path("direction");
        if (direction.isTextual()) {
            String raw = trim(direction.asText(""));
            if ("out".equalsIgnoreCase(raw) || "outgoing".equalsIgnoreCase(raw) || "sent".equalsIgnoreCase(raw)) {
                return "OUT";
            }
            if ("in".equalsIgnoreCase(raw) || "incoming".equalsIgnoreCase(raw) || "received".equalsIgnoreCase(raw)) {
                return "IN";
            }
        }
        JsonNode fromMeDirect = node.path("fromMe");
        if (fromMeDirect.isBoolean() && fromMeDirect.booleanValue()) {
            return "OUT";
        }
        JsonNode fromMe = node.at("/key/fromMe");
        if (fromMe.isBoolean() && fromMe.booleanValue()) {
            return "OUT";
        }
        return "IN";
    }

    private String extractContact(JsonNode node) {
        String[] options = {
            node.at("/key/remoteJid").asText(""),
            node.at("/key/participant").asText(""),
            node.at("/chat/id").asText(""),
            node.at("/chat/jid").asText(""),
            node.path("from").asText(""),
            node.path("to").asText(""),
            node.path("sender").asText(""),
            node.path("recipient").asText(""),
            node.path("number").asText(""),
            node.path("chatId").asText(""),
            node.path("jid").asText(""),
            node.path("author").asText(""),
            node.path("remoteJid").asText("")
        };
        for (String option : options) {
            String normalized = normalizeContact(option);
            if (!normalized.isBlank()) {
                return normalized;
            }
        }
        return "";
    }

    private String extractText(JsonNode node) {
        String[] options = {
            node.at("/message/conversation").asText(""),
            node.at("/message/extendedTextMessage/text").asText(""),
            node.at("/message/text").asText(""),
            node.at("/messageTemplate/text").asText(""),
            node.at("/data/text").asText(""),
            node.at("/data/body").asText(""),
            node.path("text").asText(""),
            node.path("body").asText(""),
            node.path("caption").asText(""),
            node.path("message").asText(""),
            node.path("msg").asText(""),
            node.path("content").asText("")
        };
        for (String option : options) {
            String value = trim(option);
            if (!value.isBlank()) {
                return value;
            }
        }
        return "";
    }

    private String extractExternalId(JsonNode node) {
        String id = trim(node.at("/key/id").asText(""));
        if (!id.isBlank()) {
            return id;
        }
        return trim(node.path("id").asText(""));
    }

    private String extractStatus(JsonNode node) {
        String status = trim(node.path("status").asText(""));
        return status.isBlank() ? "RECEIVED" : status;
    }

    private String normalizeContact(String raw) {
        String value = trim(raw);
        if (value.contains("@")) {
            value = value.substring(0, value.indexOf('@'));
        }
        value = value.replaceAll("\\D", "");
        return value;
    }

    private String toJson(JsonNode node) {
        try {
            return objectMapper.writeValueAsString(node);
        } catch (Exception ignored) {
            return "";
        }
    }

    private record VoiceAgentConfig(
        boolean enabled,
        boolean autoCallOnLeadCreate,
        String provider,
        String webhookUrl,
        String apiKey,
        String agentId,
        String fromNumber,
        String webhookSecret,
        String callbackWebhookUrl,
        String bolnaApiUrl,
        String bolnaApiKey,
        String bolnaAgentId,
        String bolnaVoiceId
    ) { }
}
