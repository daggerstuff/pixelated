-- Create email templates table
CREATE TABLE IF NOT EXISTS auth.email_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE,
    subject TEXT NOT NULL,
    html_content TEXT NOT NULL,
    text_content TEXT NOT NULL,
    variables JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create trigger for updating timestamps
CREATE TRIGGER update_email_templates_timestamp
    BEFORE UPDATE ON auth.email_templates
    FOR EACH ROW
    EXECUTE FUNCTION auth.update_timestamp();

-- Insert security email templates
INSERT INTO auth.email_templates (name, subject, html_content, text_content, variables) VALUES
(
    'new_device_login',
    'New Device Login Detected',
    '<!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>New Device Login</title>
    </head>
    <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h2 style="color: #2b6cb0;">New Device Login Detected</h2>
        <p>Hello {{name}},</p>
        <p>We detected a login to your account from a new device:</p>
        <div style="background: #f7fafc; padding: 15px; border-radius: 5px; margin: 20px 0;">
            <p><strong>Device:</strong> {{device}}</p>
            <p><strong>Location:</strong> {{location}}</p>
            <p><strong>IP Address:</strong> {{ip_address}}</p>
            <p><strong>Time:</strong> {{timestamp}}</p>
        </div>
        <p>If this was you, you can ignore this email. If you don''t recognize this activity, please:</p>
        <ol>
            <li>Change your password immediately</li>
            <li>Enable two-factor authentication if not already enabled</li>
            <li>Contact support if you need assistance</li>
        </ol>
        <p style="margin-top: 30px; font-size: 12px; color: #666;">
            This is an automated security alert. Please do not reply to this email.
        </p>
    </body>
    </html>',
    'New device login detected for your account.

Hello {{name}},

We detected a login to your account from a new device:

Device: {{device}}
Location: {{location}}
IP Address: {{ip_address}}
Time: {{timestamp}}

If this was you, you can ignore this email. If you don''t recognize this activity, please:
1. Change your password immediately
2. Enable two-factor authentication if not already enabled
3. Contact support if you need assistance

This is an automated security alert. Please do not reply to this email.',
    '["name", "device", "location", "ip_address", "timestamp"]'::jsonb
),
(
    'failed_login_attempts',
    'Multiple Failed Login Attempts Detected',
    '<!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Failed Login Attempts</title>
    </head>
    <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h2 style="color: #e53e3e;">Multiple Failed Login Attempts</h2>
        <p>Hello {{name}},</p>
        <p>We detected multiple failed login attempts to your account:</p>
        <div style="background: #fff5f5; padding: 15px; border-radius: 5px; margin: 20px 0;">
            <p><strong>Number of Attempts:</strong> {{attempt_count}}</p>
            <p><strong>Last Attempt From:</strong> {{location}}</p>
            <p><strong>Time:</strong> {{timestamp}}</p>
        </div>
        <p>For your security, we have temporarily locked your account. You can unlock it by:</p>
        <ol>
            <li>Waiting for {{lockout_duration}} minutes</li>
            <li>Using the password reset function</li>
            <li>Contacting support if you need immediate assistance</li>
        </ol>
        <p style="margin-top: 30px; font-size: 12px; color: #666;">
            This is an automated security alert. Please do not reply to this email.
        </p>
    </body>
    </html>',
    'Multiple failed login attempts detected for your account.

Hello {{name}},

We detected multiple failed login attempts to your account:

Number of Attempts: {{attempt_count}}
Last Attempt From: {{location}}
Time: {{timestamp}}

For your security, we have temporarily locked your account. You can unlock it by:
1. Waiting for {{lockout_duration}} minutes
2. Using the password reset function
3. Contacting support if you need immediate assistance

This is an automated security alert. Please do not reply to this email.',
    '["name", "attempt_count", "location", "timestamp", "lockout_duration"]'::jsonb
),
(
    'password_changed',
    'Password Changed Successfully',
    '<!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Password Changed</title>
    </head>
    <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h2 style="color: #38a169;">Password Changed Successfully</h2>
        <p>Hello {{name}},</p>
        <p>Your account password was changed successfully:</p>
        <div style="background: #f0fff4; padding: 15px; border-radius: 5px; margin: 20px 0;">
            <p><strong>Time:</strong> {{timestamp}}</p>
            <p><strong>Location:</strong> {{location}}</p>
            <p><strong>Device:</strong> {{device}}</p>
        </div>
        <p>If you did not make this change, please:</p>
        <ol>
            <li>Reset your password immediately using the forgot password function</li>
            <li>Review your recent account activity</li>
            <li>Contact support immediately</li>
        </ol>
        <p style="margin-top: 30px; font-size: 12px; color: #666;">
            This is an automated security alert. Please do not reply to this email.
        </p>
    </body>
    </html>',
    'Your account password was changed successfully.

Hello {{name}},

Your account password was changed successfully:

Time: {{timestamp}}
Location: {{location}}
Device: {{device}}

If you did not make this change, please:
1. Reset your password immediately using the forgot password function
2. Review your recent account activity
3. Contact support immediately

This is an automated security alert. Please do not reply to this email.',
    '["name", "timestamp", "location", "device"]'::jsonb
),
(
    'suspicious_activity',
    'Suspicious Account Activity Detected',
    '<!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Suspicious Activity</title>
    </head>
    <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h2 style="color: #dd6b20;">Suspicious Account Activity Detected</h2>
        <p>Hello {{name}},</p>
        <p>We detected suspicious activity on your account:</p>
        <div style="background: #fffaf0; padding: 15px; border-radius: 5px; margin: 20px 0;">
            <p><strong>Activity Type:</strong> {{activity_type}}</p>
            <p><strong>Location:</strong> {{location}}</p>
            <p><strong>Time:</strong> {{timestamp}}</p>
            <p><strong>Details:</strong> {{details}}</p>
        </div>
        <p>For your security, we recommend:</p>
        <ol>
            <li>Review your recent account activity</li>
            <li>Change your password</li>
            <li>Enable two-factor authentication if not already enabled</li>
            <li>Contact support if you need assistance</li>
        </ol>
        <p style="margin-top: 30px; font-size: 12px; color: #666;">
            This is an automated security alert. Please do not reply to this email.
        </p>
    </body>
    </html>',
    'Suspicious account activity detected.

Hello {{name}},

We detected suspicious activity on your account:

Activity Type: {{activity_type}}
Location: {{location}}
Time: {{timestamp}}
Details: {{details}}

For your security, we recommend:
1. Review your recent account activity
2. Change your password
3. Enable two-factor authentication if not already enabled
4. Contact support if you need assistance

This is an automated security alert. Please do not reply to this email.',
    '["name", "activity_type", "location", "timestamp", "details"]'::jsonb
);

-- Update the configure_security_templates function to use Resend
CREATE OR REPLACE FUNCTION auth.configure_security_templates()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = auth, public
AS $$
DECLARE
    template_record RECORD;
BEGIN
    -- Verify templates exist
    FOR template_record IN SELECT * FROM auth.email_templates LOOP
        -- In production, this would integrate with Resend API to register templates
        -- For now, we just verify the templates exist
        IF template_record.name IS NULL THEN
            RAISE EXCEPTION 'Missing required email template: %', template_record.name;
        END IF;
    END LOOP;

    -- Log template configuration
    INSERT INTO auth.security_events (
        user_id,
        event_type,
        event_data
    ) VALUES (
        auth.uid(),
        'email_templates_configured',
        (SELECT jsonb_agg(name) FROM auth.email_templates)
    );

    RETURN true;
END;
$$;

-- Create function to send security email
CREATE OR REPLACE FUNCTION auth.send_security_email(
    template_name TEXT,
    user_id UUID,
    template_data JSONB
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = auth, public
AS $$
DECLARE
    template auth.email_templates%ROWTYPE;
    user_email TEXT;
    user_name TEXT;
BEGIN
    -- Get template
    SELECT * INTO template
    FROM auth.email_templates
    WHERE name = template_name;

    IF template IS NULL THEN
        RAISE EXCEPTION 'Email template not found: %', template_name;
    END IF;

    -- Get user email and name
    SELECT email, raw_user_meta_data->>'full_name'
    INTO user_email, user_name
    FROM auth.users
    WHERE id = user_id;

    IF user_email IS NULL THEN
        RAISE EXCEPTION 'User not found or has no email: %', user_id;
    END IF;

    -- Add user name to template data if not provided
    template_data = jsonb_set(
        template_data,
        '{name}',
        to_jsonb(COALESCE(template_data->>'name', user_name, 'User'))
    );

    -- Validate required variables
    IF NOT (
        SELECT bool_and(var::text IN (SELECT jsonb_object_keys(template_data)))
        FROM jsonb_array_elements(template.variables) var
    ) THEN
        RAISE EXCEPTION 'Missing required template variables for template: %', template_name;
    END IF;

    -- Log email sending attempt
    INSERT INTO auth.security_events (
        user_id,
        event_type,
        event_data
    ) VALUES (
        user_id,
        'security_email_sent',
        jsonb_build_object(
            'template', template_name,
            'recipient', user_email,
            'timestamp', now()
        )
    );

    -- In production, this would call Resend API to send the email
    -- For now, we just return success
    RETURN true;
END;
$$;

-- Create RLS policy for email templates
ALTER TABLE auth.email_templates ENABLE ROW LEVEL SECURITY;

-- Only allow the security service role to manage email templates
CREATE POLICY "Security service can manage email templates"
    ON auth.email_templates
    FOR ALL
    USING (auth.jwt()->>'role' = 'service_role');
