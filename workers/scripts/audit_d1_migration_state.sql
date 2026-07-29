-- Read-only audit for reconciling Wrangler's d1_migrations registry.
-- Returns one row per migration with ok=1 only when the final production
-- schema/data still proves that migration (or a later canonical replacement)
-- is present.

WITH checks(migration, check_name, ok) AS (
  VALUES
    ('0002_add_quiz_tags.sql', 'quizzes.tags', EXISTS(SELECT 1 FROM pragma_table_info('quizzes') WHERE name='tags')),

    ('0003_add_tags_to_questions.sql', 'questions.tags', EXISTS(SELECT 1 FROM pragma_table_info('questions') WHERE name='tags')),
    ('0003_add_tags_to_questions.sql', 'idx_questions_tags', EXISTS(SELECT 1 FROM sqlite_master WHERE type='index' AND name='idx_questions_tags')),

    ('0004_add_perf_indexes.sql', 'idx_results_submitted_at', EXISTS(SELECT 1 FROM sqlite_master WHERE type='index' AND name='idx_results_submitted_at')),

    ('0005_add_gift_shop.sql', 'gift tables', (SELECT COUNT(*)=5 FROM sqlite_master WHERE type='table' AND name IN ('gift_catalog_items','gift_orders','gift_vouchers','gift_wallet_ledger','gift_order_events'))),
    ('0005_add_gift_shop.sql', 'gift indexes', (SELECT COUNT(*)=8 FROM sqlite_master WHERE type='index' AND name IN ('idx_gift_catalog_active','idx_gift_orders_status','idx_gift_orders_student','idx_gift_orders_class','idx_gift_orders_updated_at','idx_gift_vouchers_order','idx_gift_ledger_student','idx_gift_events_created_at'))),

    ('0006_add_attendance_claims.sql', 'attendance table', EXISTS(SELECT 1 FROM sqlite_master WHERE type='table' AND name='attendance_claims')),
    ('0006_add_attendance_claims.sql', 'attendance indexes', (SELECT COUNT(*)=2 FROM sqlite_master WHERE type='index' AND name IN ('idx_attendance_user_date','idx_attendance_user_week'))),

    ('0007_add_rag_tables.sql', 'rag tables', (SELECT COUNT(*)=4 FROM sqlite_master WHERE type='table' AND name IN ('rag_documents','rag_chunks','rag_chunks_fts','rag_query_logs'))),
    ('0007_add_rag_tables.sql', 'rag indexes', (SELECT COUNT(*)=4 FROM sqlite_master WHERE type='index' AND name IN ('idx_rag_documents_source_path','idx_rag_chunks_document_id','idx_rag_chunks_chunk_index','idx_rag_logs_created_at'))),

    ('0008_add_system_settings.sql', 'system_settings table', EXISTS(SELECT 1 FROM sqlite_master WHERE type='table' AND name='system_settings')),
    ('0008_add_system_settings.sql', 'ai_assistant_enabled seed', EXISTS(SELECT 1 FROM system_settings WHERE setting_key='ai_assistant_enabled')),

    ('0009_extend_announcements.sql', 'announcement banner columns', (SELECT COUNT(*)=6 FROM pragma_table_info('announcements') WHERE name IN ('banner_title','banner_subtitle','banner_link','banner_image','is_banner_active','days_to_live'))),

    ('0010_add_analytics_json.sql', 'results.analytics_json', EXISTS(SELECT 1 FROM pragma_table_info('results') WHERE name='analytics_json')),
    ('0010_add_analytics_json.sql', 'hw_submissions.analytics_json', EXISTS(SELECT 1 FROM pragma_table_info('hw_submissions') WHERE name='analytics_json')),
    ('0010_add_analytics_json.sql', 'results analytics index', EXISTS(SELECT 1 FROM sqlite_master WHERE type='index' AND name='idx_results_analytics')),

    ('0011_create_test_bank.sql', 'test_bank table', EXISTS(SELECT 1 FROM sqlite_master WHERE type='table' AND name='test_bank')),
    ('0011_create_test_bank.sql', 'idx_test_bank_teacher', EXISTS(SELECT 1 FROM sqlite_master WHERE type='index' AND name='idx_test_bank_teacher')),

    ('0012_add_teacher_ai_daily_usage.sql', 'teacher_ai_daily_usage table', EXISTS(SELECT 1 FROM sqlite_master WHERE type='table' AND name='teacher_ai_daily_usage')),
    ('0012_add_teacher_ai_daily_usage.sql', 'idx_teacher_ai_daily_usage_date', EXISTS(SELECT 1 FROM sqlite_master WHERE type='index' AND name='idx_teacher_ai_daily_usage_date')),

    ('0013_add_question_skill_metadata.sql', 'question skill columns', (SELECT COUNT(*)=3 FROM pragma_table_info('questions') WHERE name IN ('subject','skill_code','subskill_code'))),
    ('0014_add_question_difficulty.sql', 'questions.difficulty', EXISTS(SELECT 1 FROM pragma_table_info('questions') WHERE name='difficulty')),

    ('0015_add_game_loop_tables.sql', 'game loop tables', (SELECT COUNT(*)=5 FROM sqlite_master WHERE type='table' AND name IN ('student_game_profiles','student_daily_progress','student_achievement_unlocks','student_reward_events','student_game_activity_events'))),
    ('0015_add_game_loop_tables.sql', 'game loop indexes', (SELECT COUNT(*)=3 FROM sqlite_master WHERE type='index' AND name IN ('idx_game_achievement_user_code','idx_game_reward_events_user_date','idx_game_activity_events_user_date'))),

    ('0016_add_live_exam_tables.sql', 'live exam core tables', (SELECT COUNT(*)=3 FROM sqlite_master WHERE type='table' AND name IN ('live_exam_sessions','live_exam_participants','live_exam_activity'))),
    ('0016_add_live_exam_tables.sql', 'live exam core indexes', (SELECT COUNT(*)=8 FROM sqlite_master WHERE type='index' AND name IN ('idx_live_exam_sessions_access_code','idx_live_exam_sessions_status','idx_live_exam_sessions_teacher','idx_live_exam_sessions_class','idx_live_exam_participants_session','idx_live_exam_participants_student','idx_live_exam_participants_rank','idx_live_exam_activity_session'))),

    ('0017_add_live_exam_waiting_room_chat.sql', 'live_exam_sessions.chat_enabled', EXISTS(SELECT 1 FROM pragma_table_info('live_exam_sessions') WHERE name='chat_enabled')),
    ('0017_add_live_exam_waiting_room_chat.sql', 'chat table/index', EXISTS(SELECT 1 FROM sqlite_master WHERE type='table' AND name='live_exam_chat_messages') AND EXISTS(SELECT 1 FROM sqlite_master WHERE type='index' AND name='idx_live_exam_chat_session_created')),

    ('0018_add_live_exam_analytics.sql', 'analytics tables', (SELECT COUNT(*)=2 FROM sqlite_master WHERE type='table' AND name IN ('live_exam_question_analytics','live_exam_student_timing'))),
    ('0018_add_live_exam_analytics.sql', 'analytics indexes', (SELECT COUNT(*)=5 FROM sqlite_master WHERE type='index' AND name IN ('idx_live_exam_qa_session','idx_live_exam_qa_session_question','idx_live_exam_timing_session','idx_live_exam_timing_participant','idx_live_exam_timing_session_question'))),

    ('0019_add_phieu_nhanxet.sql', 'phieu tables', (SELECT COUNT(*)=4 FROM sqlite_master WHERE type='table' AND name IN ('phieu_nhanxet','phieu_batch','phieu_batch_items','phieu_public_links'))),
    ('0019_add_phieu_nhanxet.sql', 'phieu indexes', (SELECT COUNT(*)>=7 FROM sqlite_master WHERE type='index' AND name IN ('idx_phieu_student','idx_phieu_submission','idx_batch_assign','idx_batch_items','idx_public_links_phieu','idx_public_links_batch','idx_phieu_public_links_token','idx_phieu_nhanxet_submission_id','idx_phieu_batch_items_batch_id'))),

    ('0020_canonicalize_certificates.sql', 'canonical certificate tables', (SELECT COUNT(*)=4 FROM sqlite_master WHERE type='table' AND name IN ('certificate_templates','certificate_batches','certificates','notifications'))),
    ('0020_canonicalize_certificates.sql', 'canonical batch columns', (SELECT COUNT(*)=7 FROM pragma_table_info('certificate_batches') WHERE name IN ('request_id','attempt_count','processing_started_at','error_message','updated_at','status','template_id'))),
    ('0020_canonicalize_certificates.sql', 'canonical certificate columns', (SELECT COUNT(*)=8 FROM pragma_table_info('certificates') WHERE name IN ('student_name','student_score','quiz_title','png_r2_key','attempt_count','error_message','updated_at','status'))),
    ('0020_canonicalize_certificates.sql', 'certificate indexes', (SELECT COUNT(*)=10 FROM sqlite_master WHERE type='index' AND name IN ('idx_templates_school','idx_templates_active','idx_templates_created_by','idx_batches_teacher','idx_batches_status','idx_certs_student','idx_certs_batch','idx_certs_status','idx_notifications_user','idx_notifications_created'))),
    ('0020_canonicalize_certificates.sql', 'no legacy certificate tables', NOT EXISTS(SELECT 1 FROM sqlite_master WHERE type='table' AND name LIKE '%legacy_0020')),

    ('0021_certificate_template_layout.sql', 'template layout columns', (SELECT COUNT(*)=3 FROM pragma_table_info('certificate_templates') WHERE name IN ('is_default','canvas_width','canvas_height'))),
    ('0021_certificate_template_layout.sql', 'idx_templates_default', EXISTS(SELECT 1 FROM sqlite_master WHERE type='index' AND name='idx_templates_default')),

    ('0022_default_certificate_name_font.sql', 'canonical TôHiệuQuiz default template font',
      (SELECT COUNT(*)=1 FROM certificate_templates
       WHERE is_default=1
         AND id IN (
           'tohieuquiz-classic-red-navy-2026',
           'tohieuquiz-modern-color-2026',
           'tohieuquiz-formal-blue-2026',
           'tohieuquiz-kids-learning-2026',
           'tohieuquiz-geometric-navy-orange-2026'
         ))
      AND EXISTS(
        SELECT 1
        FROM certificate_templates AS template,
             json_each(template.fields_config) AS field
        WHERE template.is_default=1
          AND json_extract(field.value, '$.key')='student_name'
          AND json_extract(field.value, '$.fontFamily')='Great Vibes'
      )
    ),

    ('0023_certificate_batch_text_overrides.sql', 'certificate batch text columns', (SELECT COUNT(*)=2 FROM pragma_table_info('certificate_batches') WHERE name IN ('achievement_prefix','date_line'))),

    ('0024_archive_classroom_records.sql', 'class/student archive columns', EXISTS(SELECT 1 FROM pragma_table_info('classes') WHERE name='archived_at') AND EXISTS(SELECT 1 FROM pragma_table_info('students') WHERE name='archived_at')),
    ('0024_archive_classroom_records.sql', 'class/student archive indexes', (SELECT COUNT(*)=2 FROM sqlite_master WHERE type='index' AND name IN ('idx_classes_active_teacher','idx_students_active_class'))),

    ('0025_canonicalize_homework.sql', 'canonical homework columns',
      (SELECT COUNT(*)=8 FROM pragma_table_info('hw_assignments') WHERE name IN ('status','max_attempts','published_at','updated_at','archived_at','source_ocr_text','rubric_json','created_at'))
      AND
      (SELECT COUNT(*)=10 FROM pragma_table_info('hw_submissions') WHERE name IN ('attempt_no','idempotency_key','ai_score','ai_confidence','ai_feedback','grading_breakdown_json','graded_by','graded_at','published_at','analytics_json'))),
    ('0025_canonicalize_homework.sql', 'canonical homework indexes', (SELECT COUNT(*)=5 FROM sqlite_master WHERE type='index' AND name IN ('idx_hw_assignments_class_status','idx_hw_assignments_teacher_status','idx_hw_submissions_assignment_latest','idx_hw_submissions_student_latest','idx_hw_submissions_published'))),
    ('0025_canonicalize_homework.sql', 'no homework v2 staging tables', NOT EXISTS(SELECT 1 FROM sqlite_master WHERE type='table' AND name IN ('hw_assignments_v2','hw_submissions_v2'))),

    ('0026_live_exam_hardening.sql', 'live_exam_sessions.archived_at', EXISTS(SELECT 1 FROM pragma_table_info('live_exam_sessions') WHERE name='archived_at')),
    ('0026_live_exam_hardening.sql', 'live exam archive indexes', (SELECT COUNT(*)=2 FROM sqlite_master WHERE type='index' AND name IN ('idx_live_exam_sessions_teacher_archive_status','idx_live_exam_sessions_access_active'))),
    ('0026_live_exam_hardening.sql', 'legacy class backfill complete', NOT EXISTS(
      SELECT 1 FROM live_exam_sessions s
      WHERE (s.class_id IS NULL OR s.class_id='')
        AND EXISTS (
          SELECT 1 FROM live_exam_participants p
          JOIN students st ON st.id=p.student_id
          WHERE p.live_exam_id=s.id AND st.class_id IS NOT NULL
        )
    )),

    ('0027_math_format_observability.sql', 'questions.math_format_version', EXISTS(SELECT 1 FROM pragma_table_info('questions') WHERE name='math_format_version')),
    ('0027_math_format_observability.sql', 'math observability tables', (SELECT COUNT(*)=2 FROM sqlite_master WHERE type='table' AND name IN ('question_math_repairs','math_render_events'))),
    ('0027_math_format_observability.sql', 'math observability indexes', (SELECT COUNT(*)=5 FROM sqlite_master WHERE type='index' AND name IN ('idx_questions_math_format_version','idx_question_math_repairs_batch','idx_question_math_repairs_question','idx_math_render_events_last_seen','idx_math_render_events_quiz'))),

    ('0028_harden_teacher_accounts.sql', 'teacher account columns', (SELECT COUNT(*)=10 FROM pragma_table_info('teachers') WHERE name IN ('status','must_change_password','token_version','password_changed_at','last_login_at','disabled_at','disabled_by','disabled_reason','created_at','updated_at'))),
    ('0028_harden_teacher_accounts.sql', 'teacher account indexes', (SELECT COUNT(*)=2 FROM sqlite_master WHERE type='index' AND name IN ('idx_teachers_status_role','idx_classes_teacher_username'))),
    ('0028_harden_teacher_accounts.sql', 'admin audit log table/indexes', EXISTS(SELECT 1 FROM sqlite_master WHERE type='table' AND name='admin_audit_logs') AND (SELECT COUNT(*)=2 FROM sqlite_master WHERE type='index' AND name IN ('idx_admin_audit_actor_created','idx_admin_audit_target_created'))),

    ('0029_canonicalize_system_announcements.sql', 'announcement delivery columns', (SELECT COUNT(*)=7 FROM pragma_table_info('announcements') WHERE name IN ('status','audience','starts_at','ends_at','created_by','updated_by','created_at'))),
    ('0029_canonicalize_system_announcements.sql', 'announcement delivery index', EXISTS(SELECT 1 FROM sqlite_master WHERE type='index' AND name='idx_announcements_delivery')),

    ('0030_backfill_result_scores.sql', 'fully graded result metrics reconciled', NOT EXISTS(
      SELECT 1
      FROM results
      WHERE json_valid(answers) = 1
        AND total_questions > 0
        AND (
          SELECT COUNT(*)
          FROM json_each(results.answers) AS answer
          WHERE substr(answer.key, 1, 1) <> '_'
            AND CASE WHEN json_valid(answer.value) = 1
              THEN json_type(answer.value, '$.isCorrect')
              ELSE NULL
            END IN ('true', 'false')
        ) = total_questions
        AND (
          correct_count <> (
            SELECT SUM(
              CASE WHEN json_valid(answer.value) = 1
                THEN CASE WHEN json_extract(answer.value, '$.isCorrect') = 1 THEN 1 ELSE 0 END
                ELSE 0
              END
            )
            FROM json_each(results.answers) AS answer
            WHERE substr(answer.key, 1, 1) <> '_'
          )
          OR ABS(
            score - ROUND((
              SELECT SUM(
                CASE WHEN json_valid(answer.value) = 1
                  THEN CASE WHEN json_extract(answer.value, '$.isCorrect') = 1 THEN 1 ELSE 0 END
                  ELSE 0
                END
              )
              FROM json_each(results.answers) AS answer
              WHERE substr(answer.key, 1, 1) <> '_'
            ) * 10.0 / total_questions, 1)
          ) > 0.001
        )
    )),

    ('0032_add_result_report_delivery.sql', 'result report batch columns',
      (SELECT COUNT(*)=7 FROM pragma_table_info('phieu_batch')
       WHERE name IN ('request_id','quiz_id','attempt_policy','notify_students','create_parent_links','delivery_status','updated_at'))),
    ('0032_add_result_report_delivery.sql', 'result report delivery table',
      EXISTS(SELECT 1 FROM sqlite_master WHERE type='table' AND name='result_report_delivery_items')),
    ('0032_add_result_report_delivery.sql', 'result report delivery indexes',
      (SELECT COUNT(*)=5 FROM sqlite_master WHERE type='index' AND name IN (
        'idx_phieu_batch_teacher_request','idx_result_report_items_batch','idx_result_report_items_student',
        'idx_result_report_items_notification','idx_result_report_items_public_link'
      ))),

    ('0036_seed_tohieuquiz_certificate_templates.sql', 'five TôHiệuQuiz templates seeded',
      (SELECT COUNT(*)=5 FROM certificate_templates WHERE id IN (
        'tohieuquiz-classic-red-navy-2026',
        'tohieuquiz-modern-color-2026',
        'tohieuquiz-formal-blue-2026',
        'tohieuquiz-kids-learning-2026',
        'tohieuquiz-geometric-navy-orange-2026'
      ))),
    ('0036_seed_tohieuquiz_certificate_templates.sql', 'TôHiệuQuiz template canvas and dynamic fields',
      NOT EXISTS(
        SELECT 1 FROM certificate_templates
        WHERE id IN (
          'tohieuquiz-classic-red-navy-2026',
          'tohieuquiz-modern-color-2026',
          'tohieuquiz-formal-blue-2026',
          'tohieuquiz-kids-learning-2026',
          'tohieuquiz-geometric-navy-orange-2026'
        )
        AND (
          canvas_width <> 1270 OR canvas_height <> 698
          OR json_valid(fields_config) = 0
          OR NOT EXISTS (SELECT 1 FROM json_each(certificate_templates.fields_config) WHERE json_extract(value, '$.key')='student_name')
          OR NOT EXISTS (SELECT 1 FROM json_each(certificate_templates.fields_config) WHERE json_extract(value, '$.key')='quiz_title')
          OR NOT EXISTS (SELECT 1 FROM json_each(certificate_templates.fields_config) WHERE json_extract(value, '$.key')='score')
          OR NOT EXISTS (SELECT 1 FROM json_each(certificate_templates.fields_config) WHERE json_extract(value, '$.key')='date')
          OR NOT EXISTS (SELECT 1 FROM json_each(certificate_templates.fields_config) WHERE json_extract(value, '$.key')='teacher_name')
        )
      )),

    ('0031_add_reward_receipts.sql', 'reward receipt table and index',
      EXISTS(SELECT 1 FROM sqlite_master WHERE type='table' AND name='reward_receipts')
      AND EXISTS(SELECT 1 FROM sqlite_master WHERE type='index' AND name='idx_reward_receipts_activity')),

    ('0033_create_quiz_drafts.sql', 'quiz drafts table and index',
      EXISTS(SELECT 1 FROM sqlite_master WHERE type='table' AND name='quiz_drafts')
      AND EXISTS(SELECT 1 FROM sqlite_master WHERE type='index' AND name='idx_quiz_drafts_owner_updated')),

    ('0034_add_question_authoring_fields.sql', 'question authoring columns',
      (SELECT COUNT(*)=2 FROM pragma_table_info('questions') WHERE name IN ('points','explanation'))),

    ('0035_add_question_image_alt.sql', 'question image alt column',
      EXISTS(SELECT 1 FROM pragma_table_info('questions') WHERE name='image_alt')),

    ('0037_add_parent_portal_complete.sql', 'parent portal result identity',
      EXISTS(SELECT 1 FROM pragma_table_info('results') WHERE name='student_id')
      AND EXISTS(SELECT 1 FROM sqlite_master WHERE type='index' AND name='idx_results_student_id_submitted')),
    ('0037_add_parent_portal_complete.sql', 'parent portal tables',
      (SELECT COUNT(*)=4 FROM sqlite_master WHERE type='table' AND name IN (
        'parent_links','parent_activation_tokens','parent_class_announcements','parent_notifications'
      ))),
    ('0037_add_parent_portal_complete.sql', 'parent portal indexes',
      (SELECT COUNT(*)=7 FROM sqlite_master WHERE type='index' AND name IN (
        'idx_parent_links_one_active_student','idx_parent_links_creator_created','idx_parent_activation_link',
        'idx_parent_announcements_class_published','idx_parent_notifications_unique_source',
        'idx_parent_notifications_student_feed','idx_parent_notifications_student_unread'
      ))),

    ('0038_normalize_quiz_ownership.sql', 'quiz ownership index',
      EXISTS(SELECT 1 FROM sqlite_master WHERE type='index' AND name='idx_quizzes_created_by')),

    ('0039_create_ai_generation_actions.sql', 'AI generation tables',
      (SELECT COUNT(*)=2 FROM sqlite_master WHERE type='table' AND name IN ('teacher_ai_daily_usage','ai_generation_actions'))),
    ('0039_create_ai_generation_actions.sql', 'AI generation indexes',
      (SELECT COUNT(*)=3 FROM sqlite_master WHERE type='index' AND name IN (
        'idx_teacher_ai_daily_usage_date','idx_ai_generation_actions_user_date','idx_ai_generation_actions_stale'
      ))),

    ('0040_scope_results_to_assignments.sql', 'assignment-scoped result column and index',
      EXISTS(SELECT 1 FROM pragma_table_info('results') WHERE name='assignment_id')
      AND EXISTS(SELECT 1 FROM sqlite_master WHERE type='index' AND name='idx_results_assignment_student')),

    ('0041_certificate_layout_and_name_fonts.sql', 'certificate batch student-name font',
      EXISTS(SELECT 1 FROM pragma_table_info('certificate_batches') WHERE name='student_name_font')),
    ('0041_certificate_layout_and_name_fonts.sql', 'certificate field baselines and widths',
      NOT EXISTS(
        SELECT 1
        FROM certificate_templates AS template
        WHERE template.id IN (
          'tohieuquiz-classic-red-navy-2026',
          'tohieuquiz-modern-color-2026',
          'tohieuquiz-formal-blue-2026',
          'tohieuquiz-kids-learning-2026',
          'tohieuquiz-geometric-navy-orange-2026'
        )
        AND (
          NOT EXISTS(
            SELECT 1 FROM json_each(template.fields_config) AS field
            WHERE json_extract(field.value, '$.key')='student_name'
              AND json_extract(field.value, '$.baseline')='alphabetic'
              AND json_extract(field.value, '$.maxWidth')=680
          )
          OR NOT EXISTS(
            SELECT 1 FROM json_each(template.fields_config) AS field
            WHERE json_extract(field.value, '$.key')='score'
              AND json_extract(field.value, '$.baseline')='middle'
          )
        )
      )),

    ('0042_unified_notifications.sql', 'unified announcement columns',
      (SELECT COUNT(*)=5 FROM pragma_table_info('announcements')
       WHERE name IN ('priority','channels_json','dismissible','cta_label','surface_overrides_json'))),
    ('0042_unified_notifications.sql', 'unified inbox columns',
      (SELECT COUNT(*)=5 FROM pragma_table_info('notifications')
       WHERE name IN ('priority','action_url','source_type','source_id','expires_at'))),
    ('0042_unified_notifications.sql', 'unified notification indexes',
      (SELECT COUNT(*)=2 FROM sqlite_master WHERE type='index'
       AND name IN ('idx_notifications_inbox','idx_notifications_source_dedupe'))),

    ('0043_create_rate_limits.sql', 'rate limit table',
      EXISTS(SELECT 1 FROM sqlite_master WHERE type='table' AND name='rate_limits')),

    ('0044_create_ai_tutor_usage.sql', 'AI tutor usage tables and index',
      (SELECT COUNT(*)=2 FROM sqlite_master WHERE type='table'
       AND name IN ('ai_tutor_daily_usage','ai_tutor_reservations'))
      AND EXISTS(SELECT 1 FROM sqlite_master WHERE type='index'
       AND name='idx_ai_tutor_reservations_user_day')),

    ('0045_live_exam_reconnect.sql', 'live exam reconnect tables and index',
      (SELECT COUNT(*)=2 FROM sqlite_master WHERE type='table'
       AND name IN ('live_exam_answer_snapshots','live_exam_connection_events'))
      AND EXISTS(SELECT 1 FROM sqlite_master WHERE type='index'
       AND name='idx_live_exam_connection_events_session_created')),

    ('0046_live_exam_controls.sql', 'live exam control columns',
      (SELECT COUNT(*)=2 FROM pragma_table_info('live_exam_sessions')
       WHERE name IN ('paused_at','total_paused_seconds'))
      AND EXISTS(SELECT 1 FROM pragma_table_info('live_exam_participants')
       WHERE name='individual_ends_at')),
    ('0046_live_exam_controls.sql', 'live exam control tables and indexes',
      (SELECT COUNT(*)=2 FROM sqlite_master WHERE type='table'
       AND name IN ('live_exam_control_confirmations','live_exam_control_audit'))
      AND (SELECT COUNT(*)=2 FROM sqlite_master WHERE type='index'
       AND name IN ('idx_live_exam_control_confirmations_lookup','idx_live_exam_control_audit_session_created'))),

    ('0047_results_intervention_center.sql', 'intervention assignment column and tables',
      EXISTS(SELECT 1 FROM pragma_table_info('assignments') WHERE name='intervention_group_id')
      AND (SELECT COUNT(*)=5 FROM sqlite_master WHERE type='table'
       AND name IN ('intervention_groups','intervention_group_members','intervention_notes','intervention_assignment_batches','intervention_audit'))),
    ('0047_results_intervention_center.sql', 'intervention indexes',
      (SELECT COUNT(*)=6 FROM sqlite_master WHERE type='index'
       AND name IN (
        'idx_intervention_groups_teacher_updated','idx_intervention_groups_class_skill',
        'idx_intervention_members_student','idx_intervention_notes_group_created',
        'idx_intervention_audit_group_created','idx_assignments_intervention_group'
       ))),

    ('0048_parent_digest_recovery.sql', 'parent digest and recovery tables',
      (SELECT COUNT(*)=4 FROM sqlite_master WHERE type='table'
       AND name IN ('parent_contact_preferences','parent_contact_tokens','parent_digest_runs','parent_account_audit'))),
    ('0048_parent_digest_recovery.sql', 'parent digest and recovery indexes',
      (SELECT COUNT(*)=5 FROM sqlite_master WHERE type='index'
       AND name IN (
        'idx_parent_contact_preferences_digest_due','idx_parent_contact_tokens_lookup',
        'idx_parent_contact_tokens_link_created','idx_parent_digest_runs_status_updated',
        'idx_parent_account_audit_link_created'
       ))),

    ('0049_gift_shop_governance.sql', 'gift shop governance columns and settings',
      (SELECT COUNT(*)=9 FROM pragma_table_info('gift_catalog_items')
       WHERE name IN ('stock_total','stock_remaining','low_stock_threshold','weekly_limit_per_student',
        'scope_type','school_id','class_id','grade_level','created_by'))
      AND (SELECT COUNT(*)=10 FROM pragma_table_info('gift_orders')
       WHERE name IN ('item_id','school_id','grade_level','week_key','approved_by','approved_at',
        'cancelled_by','cancelled_at','transition_actor','transition_request_id'))
      AND EXISTS(SELECT 1 FROM sqlite_master WHERE type='table' AND name='gift_shop_scope_settings')),
    ('0049_gift_shop_governance.sql', 'gift shop governance triggers and indexes',
      (SELECT COUNT(*)=6 FROM sqlite_master WHERE type='trigger' AND name IN (
        'trg_gift_order_purchase_guard','trg_gift_order_purchase_commit','trg_gift_order_transition_guard',
        'trg_gift_order_approved','trg_gift_order_delivered','trg_gift_order_cancelled'))
      AND (SELECT COUNT(*)=4 FROM sqlite_master WHERE type='index' AND name IN (
        'idx_gift_catalog_scope_stock','idx_gift_orders_student_item_week',
        'idx_gift_scope_settings_lookup','idx_gift_events_request'))),
    ('0050_notification_preferences.sql', 'notification preference columns and table',
      (SELECT COUNT(*)=6 FROM pragma_table_info('notifications')
       WHERE name IN ('severity','dedupe_key','available_at','read_at','clicked_at','sent_at'))
      AND EXISTS(SELECT 1 FROM sqlite_master WHERE type='table' AND name='notification_preferences')),
    ('0050_notification_preferences.sql', 'notification delivery indexes',
      (SELECT COUNT(*)=4 FROM sqlite_master WHERE type='index' AND name IN (
        'idx_notifications_window_dedupe','idx_notifications_delivery_feed',
        'idx_notifications_metrics','idx_notification_preferences_role'))),
    ('0051_pagination_indexes.sql', 'bounded collection cursor indexes',
      (SELECT COUNT(*)=9 FROM sqlite_master WHERE type='index' AND name IN (
        'idx_results_cursor','idx_results_quiz_cursor','idx_results_class_cursor',
        'idx_students_class_name_cursor','idx_teachers_admin_cursor',
        'idx_gift_orders_class_cursor','idx_gift_orders_student_cursor',
        'idx_gift_orders_status_cursor','idx_notifications_feed_cursor'))),
    ('0052_auth_sessions_security_events.sql', 'session and security event tables',
      EXISTS(SELECT 1 FROM sqlite_master WHERE type='table' AND name='auth_sessions')
      AND EXISTS(SELECT 1 FROM sqlite_master WHERE type='table' AND name='security_events')
      AND EXISTS(SELECT 1 FROM pragma_table_info('students') WHERE name='token_version')),
    ('0052_auth_sessions_security_events.sql', 'session and security event indexes',
      (SELECT COUNT(*)=6 FROM sqlite_master WHERE type='index' AND name IN (
        'idx_auth_sessions_user_created','idx_auth_sessions_active_expiry','idx_auth_sessions_retention',
        'idx_security_events_user_created','idx_security_events_type_created','idx_security_events_retention')))
), summary AS (
  SELECT
    migration,
    MIN(CASE WHEN ok THEN 1 ELSE 0 END) AS ok,
    GROUP_CONCAT(CASE WHEN NOT ok THEN check_name END, '; ') AS failed_checks,
    COUNT(*) AS checks_run
  FROM checks
  GROUP BY migration
)
SELECT migration, ok, checks_run, COALESCE(failed_checks, '') AS failed_checks
FROM summary
ORDER BY migration;
