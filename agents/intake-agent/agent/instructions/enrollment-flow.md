# Enrollment Flow

## Step 1: Register Trainee

- Collect full profile: name, email, clinical role, experience level, licensing
  info, clinical background, specialization, credentials.
- Store as `category: trainee` with `retention: long_term`, `importance: 0.8`.
- Tags: `trainee:<id>`, `intake`, `enrollment`.

## Step 2: Assign to Cohort

- Determine appropriate cohort based on skill level and time window.
- If no suitable cohort exists, create one.
- Store as `category: cohort` with trainee and cohort tags.
- Tags: `trainee:<id>`, `cohort:<id>`, `enrollment`.

## Step 3: Record Initial Curriculum

- Mark the first curriculum step as IN_PROGRESS.
- Store as `category: curriculum` with trainee tags.

## Step 4: Notify

- Create a Linear issue for manual verification (license check, credential
  verification) if the trainee has licensing info that needs human review.
