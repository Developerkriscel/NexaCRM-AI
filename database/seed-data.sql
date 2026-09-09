-- ═══════════════════════════════════════════════════════════════════════════
--  NexaCRM AI — Sample Seed Data
--  Run after schema.sql to populate the database with realistic demo data
-- ═══════════════════════════════════════════════════════════════════════════

-- ─────────────────────────────────────────────────────────────────
--  Tenant
-- ─────────────────────────────────────────────────────────────────
INSERT INTO tenants (id, name, slug, plan, is_active, max_users) VALUES
(1, 'NexaCRM Demo Co.', 'nexacrm-demo', 'ENTERPRISE', TRUE, 50);

-- ─────────────────────────────────────────────────────────────────
--  Users (passwords are BCrypt of 'demo1234')
-- ─────────────────────────────────────────────────────────────────
INSERT INTO users (tenant_id, name, email, password, role, phone, is_active) VALUES
(1, 'Aarav Joshi',    'superadmin@nexacrm.com', '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQyCgO9U5HJXP2wt2MeqZ3N2a', 'SUPER_ADMIN',   '+91-98765-00000', TRUE),
(1, 'Nisha Kapoor',   'companyadmin@nexacrm.com','$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQyCgO9U5HJXP2wt2MeqZ3N2a', 'COMPANY_ADMIN', '+91-98765-00006', TRUE),
(1, 'Saurabh Kumar', 'saurabhke4@gmail.com',  '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQyCgO9U5HJXP2wt2MeqZ3N2a', 'ADMIN',     '+91-98765-00001', TRUE),
(1, 'Priya Sharma',  'priya@nexacrm.com',     '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQyCgO9U5HJXP2wt2MeqZ3N2a', 'MANAGER',   '+91-98765-00002', TRUE),
(1, 'Rahul Mehta',   'rahul@nexacrm.com',     '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQyCgO9U5HJXP2wt2MeqZ3N2a', 'SALES_EXEC','+91-98765-00003', TRUE),
(1, 'Amit Kumar',    'amit@nexacrm.com',      '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQyCgO9U5HJXP2wt2MeqZ3N2a', 'SALES_EXEC','+91-98765-00004', TRUE),
(1, 'Neha Singh',    'neha@nexacrm.com',      '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQyCgO9U5HJXP2wt2MeqZ3N2a', 'SALES_EXEC','+91-98765-00005', FALSE),
(1, 'Rohan Verma',   'normaluser@nexacrm.com', '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQyCgO9U5HJXP2wt2MeqZ3N2a', 'NORMAL_USER', '+91-98765-00007', TRUE);

-- ─────────────────────────────────────────────────────────────────
--  Pipeline
-- ─────────────────────────────────────────────────────────────────
INSERT INTO pipelines (tenant_id, name, is_default, currency) VALUES
(1, 'Main Sales Pipeline', TRUE, 'INR'),
(1, 'Enterprise Pipeline', FALSE, 'INR');

-- ─────────────────────────────────────────────────────────────────
--  Leads
-- ─────────────────────────────────────────────────────────────────
INSERT INTO leads (tenant_id, name, email, phone, company, source, status, score, priority, deal_value, assigned_to, tags, created_at) VALUES
(1, 'Ramesh Patel',    'ramesh@techcorp.in',      '+91-98765-43210', 'Tech Corp',        'FACEBOOK',  'NEW',         'HOT',  'HIGH',   125000,  2, 'enterprise',          NOW() - INTERVAL '4 days'),
(1, 'Arjun Sharma',    'arjun@globalsoft.com',    '+91-87654-32109', 'GlobalSoft',       'LINKEDIN',  'CONTACTED',   'WARM', 'MEDIUM',  85000,  3, 'smb',                 NOW() - INTERVAL '5 days'),
(1, 'Divya Nair',      'divya@infosys.com',       '+91-76543-21098', 'InfoSys Ltd.',     'WEBSITE',   'QUALIFIED',   'HOT',  'HIGH',   250000,  2, 'enterprise,priority', NOW() - INTERVAL '6 days'),
(1, 'Kiran Mehta',     'kiran@startup.io',        '+91-65432-10987', 'StartUp.io',       'INSTAGRAM', 'NEW',         'COLD', 'LOW',     35000,  4, 'startup',             NOW() - INTERVAL '7 days'),
(1, 'Sunita Rao',      'sunita@wipro.com',        '+91-54321-09876', 'Wipro',            'WHATSAPP',  'PROPOSAL',    'WARM', 'HIGH',   420000,  3, 'enterprise',          NOW() - INTERVAL '8 days'),
(1, 'Vijay Kumar',     'vijay@hcltech.com',       '+91-43210-98765', 'HCL Tech',         'LINKEDIN',  'NEGOTIATION', 'HOT',  'HIGH',   580000,  2, 'enterprise,priority', NOW() - INTERVAL '9 days'),
(1, 'Meera Krishnan',  'meera@freshworks.com',    '+91-32109-87654', 'Freshworks',       'FACEBOOK',  'CONTACTED',   'WARM', 'MEDIUM', 145000,  4, 'saas',                NOW() - INTERVAL '10 days'),
(1, 'Rajesh Singh',    'rajesh@mindtree.com',     '+91-21098-76543', 'Mindtree',         'REFERRAL',  'WON',         'HOT',  'HIGH',   320000,  2, 'enterprise',          NOW() - INTERVAL '11 days'),
(1, 'Priya Verma',     'priya.v@tatacomm.com',    '+91-10987-65432', 'Tata Comm',        'GOOGLE_ADS','LOST',        'COLD', 'MEDIUM', 200000,  4, '',                    NOW() - INTERVAL '20 days'),
(1, 'Amit Shah',       'amit.s@reliance.com',     '+91-99887-76543', 'Reliance Jio',     'FACEBOOK',  'NEW',         'HOT',  'HIGH',   800000,  2, 'enterprise,priority', NOW() - INTERVAL '1 day'),
(1, 'Kavya Reddy',     'kavya@zoho.com',          '+91-88776-65432', 'Zoho Corp',        'LINKEDIN',  'CONTACTED',   'WARM', 'HIGH',   350000,  3, 'saas,enterprise',     NOW() - INTERVAL '2 days'),
(1, 'Suresh Nair',     'suresh@mahindra.com',     '+91-77665-54321', 'Mahindra',         'WEBSITE',   'QUALIFIED',   'HOT',  'HIGH',   650000,  2, 'enterprise',          NOW() - INTERVAL '3 days');

-- ─────────────────────────────────────────────────────────────────
--  Deals
-- ─────────────────────────────────────────────────────────────────
INSERT INTO deals (tenant_id, title, stage, priority, deal_value, pipeline_id, lead_id, owner_id, ai_score, expected_close_date) VALUES
(1, 'Tech Corp Expansion',      'NEW',         'HIGH',   125000, 1, 1, 2, 'hot',  CURRENT_DATE + 15),
(1, 'StartUp SaaS Suite',       'NEW',         'LOW',     35000, 1, 4, 4, 'cold', CURRENT_DATE + 20),
(1, 'GlobalSoft CRM',           'CONTACTED',   'MEDIUM',  85000, 1, 2, 3, 'warm', CURRENT_DATE + 12),
(1, 'Freshworks Integration',   'CONTACTED',   'MEDIUM', 145000, 1, 7, 4, 'warm', CURRENT_DATE + 18),
(1, 'InfoSys Enterprise',       'QUALIFIED',   'HIGH',   250000, 1, 3, 2, 'hot',  CURRENT_DATE + 10),
(1, 'Wipro Cloud Suite',        'PROPOSAL',    'HIGH',   420000, 1, 5, 3, 'warm', CURRENT_DATE + 8),
(1, 'Mindtree Platform',        'PROPOSAL',    'HIGH',   320000, 1, 8, 2, 'hot',  CURRENT_DATE + 6),
(1, 'HCL Tech Package',         'NEGOTIATION', 'HIGH',   580000, 1, 6, 2, 'hot',  CURRENT_DATE + 3),
(1, 'Bajaj Finserv CRM',        'WON',         'HIGH',   480000, 1, NULL, 3, 'hot',CURRENT_DATE - 1),
(1, 'Tata Comm Deal',           'LOST',        'MEDIUM', 200000, 1, 9, 4, 'cold', CURRENT_DATE - 9),
(1, 'Reliance Jio Platform',    'NEW',         'HIGH',   800000, 2, 10, 2, 'hot', CURRENT_DATE + 25),
(1, 'Zoho Partnership',         'CONTACTED',   'HIGH',   350000, 2, 11, 3, 'warm',CURRENT_DATE + 15),
(1, 'Mahindra CRM Suite',       'QUALIFIED',   'HIGH',   650000, 2, 12, 2, 'hot', CURRENT_DATE + 12);

-- ─────────────────────────────────────────────────────────────────
--  Deal Activities
-- ─────────────────────────────────────────────────────────────────
INSERT INTO deal_activities (deal_id, user_id, type, title, description, duration_min) VALUES
(8, 2, 'CALL',         'Discovery call with Vijay Kumar',         'Discussed requirements for 50 sales reps', 45),
(8, 2, 'EMAIL',        'Sent proposal document',                  'Attached pricing and feature comparison',   NULL),
(8, 2, 'MEETING',      'Technical demo with IT team',             'Showed AI scoring and automation features',  90),
(8, 2, 'STAGE_CHANGE', 'Moved to Negotiation',                    'Client requesting 15% discount',            NULL),
(6, 3, 'CALL',         'Initial contact with Sunita Rao',        'Intro call, scheduled demo for next week',   30),
(6, 3, 'EMAIL',        'Sent product brochure',                   'Attached enterprise plan details',           NULL),
(5, 2, 'DEMO',         'Product demo for InfoSys team',          '12 people attended, very positive feedback', 120);

-- ─────────────────────────────────────────────────────────────────
--  Customers
-- ─────────────────────────────────────────────────────────────────
INSERT INTO customers (tenant_id, name, email, phone, company, industry, primary_contact, account_manager_id, health_score, status, gstin) VALUES
(1, 'Bajaj Finserv',  'accounts@bajajfinserv.in', '+91-22-4321-0987', 'Bajaj Finserv Ltd.',  'Finance', 'Rajesh Singh',  3, 92, 'ACTIVE', '27AABCB2894P1Z8'),
(1, 'Mindtree Ltd.',  'accounts@mindtree.com',    '+91-80-4321-1234', 'Mindtree Ltd.',       'IT',      'Priya Verma',   3, 78, 'ACTIVE', '29AADCM7974R1ZH'),
(1, 'TechVision',     'accounts@techvision.co',   '+91-98-7654-3210', 'TechVision Pvt Ltd.', 'SaaS',   'Arun Joshi',    4, 44, 'AT_RISK','24AABCT1206A1ZY'),
(1, 'FinEdge Corp',   'accounts@finedge.com',     '+91-11-2345-6789', 'FinEdge Corp',        'Finance', 'Seema Kapoor',  3, 85, 'ACTIVE', '07AABCF1234K1Z1');

-- ─────────────────────────────────────────────────────────────────
--  Invoices
-- ─────────────────────────────────────────────────────────────────
INSERT INTO invoices (tenant_id, invoice_number, customer_id, deal_id, status, issue_date, due_date, paid_date, subtotal, gst_rate, gst_amount, total) VALUES
(1, 'INV-1042', 1, 9, 'PAID',    '2026-04-18', '2026-05-02', '2026-04-28', 480000, 18, 86400,  566400),
(1, 'INV-1041', 3, 8, 'PENDING', '2026-04-22', '2026-05-06', NULL,         580000, 18, 104400, 684400),
(1, 'INV-1040', 1, 6, 'PENDING', '2026-04-20', '2026-05-04', NULL,         420000, 18, 75600,  495600),
(1, 'INV-1039', 2, 7, 'OVERDUE', '2026-04-05', '2026-04-19', NULL,         250000, 18, 45000,  295000),
(1, 'INV-1038', 2, 7, 'PAID',    '2026-04-10', '2026-04-24', '2026-04-20', 320000, 18, 57600,  377600),
(1, 'INV-1037', 4, 3, 'DRAFT',   '2026-04-28', '2026-05-12', NULL,          85000, 18, 15300,  100300);

-- ─────────────────────────────────────────────────────────────────
--  Workflows (Automation)
-- ─────────────────────────────────────────────────────────────────
INSERT INTO workflows (tenant_id, name, trigger, conditions, actions, is_active, run_count) VALUES
(1, 'New Lead Auto-Assign',
 'LEAD_CREATED',
 '{}',
 '[{"type":"ASSIGN_LEAD","strategy":"round-robin"},{"type":"SEND_EMAIL","template":"welcome"},{"type":"CREATE_TASK","title":"Initial contact","dueHours":24}]',
 TRUE, 147),

(1, 'Follow-up Reminder',
 'FOLLOW_UP_DUE',
 '{"hours_since_contact":24}',
 '[{"type":"SEND_NOTIFICATION","message":"Follow-up overdue for {lead_name}"},{"type":"CREATE_TASK","title":"Follow up with {lead_name}","priority":"HIGH"}]',
 TRUE, 312),

(1, 'Deal Won → Invoice',
 'DEAL_STAGE_CHANGED',
 '{"stage":"WON"}',
 '[{"type":"GENERATE_INVOICE"},{"type":"SEND_EMAIL","template":"deal_won_congrats"},{"type":"UPDATE_CUSTOMER"}]',
 TRUE, 28),

(1, 'Payment Overdue Alert',
 'INVOICE_OVERDUE',
 '{"days_overdue":7}',
 '[{"type":"SEND_EMAIL","template":"payment_reminder"},{"type":"SEND_WHATSAPP","template":"payment_reminder"},{"type":"SEND_NOTIFICATION","userId":"account_manager"}]',
 FALSE, 56),

(1, 'Hot Lead Escalation',
 'LEAD_SCORE_CHANGED',
 '{"score":"HOT"}',
 '[{"type":"SEND_NOTIFICATION","role":"MANAGER","message":"New hot lead: {lead_name}"},{"type":"CREATE_TASK","title":"Priority call with {lead_name}","priority":"HIGH"}]',
 TRUE, 41);

-- ─────────────────────────────────────────────────────────────────
--  Notifications
-- ─────────────────────────────────────────────────────────────────
INSERT INTO notifications (tenant_id, user_id, title, message, type, is_read) VALUES
(1, 1, 'New lead from Facebook',       'Ramesh Patel submitted a contact form',             'LEAD',    FALSE),
(1, 1, 'Deal moved to Proposal',       'Wipro Cloud Suite deal updated by Priya',            'DEAL',    FALSE),
(1, 1, 'Follow-up overdue',            'Call with Arjun Sharma is 1 hour overdue',           'TASK',    FALSE),
(1, 1, 'Invoice paid',                 'INV-1042 ₹4,80,000 payment received',               'INVOICE', TRUE),
(1, 1, 'AI Insight',                   'Lead score for Reliance Jio just changed to Hot 🔥', 'AI',      TRUE);

-- ─────────────────────────────────────────────────────────────────
--  Tasks
-- ─────────────────────────────────────────────────────────────────
INSERT INTO tasks (tenant_id, title, type, status, priority, due_date, lead_id, assigned_to, created_by_id) VALUES
(1, 'Follow-up call with Ramesh Patel',  'CALL',      'PENDING',    'HIGH',   NOW() + INTERVAL '1 day',  1, 2, 1),
(1, 'Send proposal to Wipro',            'EMAIL',     'PENDING',    'HIGH',   NOW() + INTERVAL '2 days', 5, 3, 1),
(1, 'Demo with InfoSys IT team',         'DEMO',      'IN_PROGRESS','HIGH',   NOW() + INTERVAL '3 days', 3, 2, 1),
(1, 'Negotiation call with HCL Tech',    'CALL',      'PENDING',    'HIGH',   NOW() + INTERVAL '1 day',  6, 2, 1),
(1, 'Follow-up with GlobalSoft',         'FOLLOW_UP', 'PENDING',    'MEDIUM', NOW() - INTERVAL '1 day',  2, 3, 1),
(1, 'Send contract to Mindtree',         'EMAIL',     'PENDING',    'HIGH',   NOW(),                     8, 2, 1),
(1, 'Onboard Bajaj Finserv',             'MEETING',   'COMPLETED',  'HIGH',   NOW() - INTERVAL '5 days', NULL, 3, 1);
