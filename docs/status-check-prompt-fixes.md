# Status Check Prompt - FIXED

**Date:** January 24, 2026  
**Issue:** Prompt was checking REJECTED and ARCHIVED jobs, wasting time  
**Solution:** Updated prompt with explicit filters and dynamic list generation

---

## ✅ WHAT WAS FIXED

### 1. **Added Explicit Rejection Filter**
**Before:**
- "SKIP ARCHIVED JOBS"

**After:**
- "SKIP ARCHIVED AND REJECTED JOBS"
- Explicitly lists criteria: no ❌ symbol, no "REJECTED" in status

### 2. **Added Critical First Step**
New section at top of prompt:
```
**CRITICAL FIRST STEP:**
Before checking any URLs, FIRST review my dashboard and create a list 
of ONLY the jobs that meet ALL these criteria:
- Status is NOT "archived"
- I have NOT been rejected (no ❌ symbol, no "REJECTED" in status)
- Job is in one of these statuses: Apply Now, Maybe, Applied (without rejection), Probably Not

Then check ONLY those jobs. Do NOT waste time checking archived or rejected jobs.
```

### 3. **Removed Rejected Jobs from Example List**
**Removed from examples:**
- Job #1: Media Cause (APPLIED - REJECTED)
- Job #25: Sincere (APPLIED - REJECTED)

**Kept in examples (non-rejected, non-archived):**
- Job #3: NDWA (APPLY NOW)
- Job #13: Sollis Health (MAYBE)
- Job #14: Age of Learning (APPLY NOW)
- Job #15: Lexia Learning (APPLIED)
- Job #16: Chorus Innovations (APPLY NOW)
- Job #17: Jobgether (MAYBE)
- Job #18: East Boston (INTERVIEW)
- Job #21: Boston Children's (APPLIED)
- Job #22: Givebutter (APPLIED)

### 4. **Updated Output Format Example**
**Before:**
```
| 1 | Media Cause | ❌ CLOSED | Link dead, posted 70+ days ago |
```

**After:**
```
| 3 | NDWA | ❌ CLOSED | Link dead, posted 2+ weeks ago |
| 15 | Lexia Learning | 🔄 REPOSTED | New URL: [link] |
```

### 5. **Clarified Dynamic List Generation**
**Updated warning:**
```
(⚠️ DO NOT copy this example list! First check the dashboard to identify 
which jobs are NOT archived and NOT rejected, then list only those jobs below)
```

---

## 🎯 HOW TO USE THE UPDATED PROMPT

### Step 1: Copy Prompt from Dashboard
Click "Copy Check Job Status Command" button

### Step 2: Paste and Review
Paste into chat with Claude

### Step 3: Claude's Required Actions
Claude must:
1. **First** - Review dashboard to identify active jobs
2. **Filter** - Remove any archived or rejected jobs
3. **List** - Create clean list of jobs to check
4. **Check** - Visit URLs and report status

### Step 4: Review Results
Claude provides table with:
- ✅ ACTIVE - Still live
- ❌ CLOSED - Should archive
- 🔄 REPOSTED - Update URL
- ⚠️ UNCERTAIN - Manual review needed

---

## 📊 WHAT TO EXPECT

### Jobs That Should Be SKIPPED:
- ❌ Media Cause - VP Creative (REJECTED - already archived)
- ❌ Sincere - Senior Manager Design (REJECTED - already archived)
- ❌ Any job with "REJECTED" in status
- ❌ Any job showing ❌ symbol
- ❌ Any job in Archived tab

### Jobs That SHOULD Be Checked:
- ✅ Jobs with status: Apply Now
- ✅ Jobs with status: Maybe
- ✅ Jobs with status: Applied (without rejection)
- ✅ Jobs with status: Probably Not
- ✅ Jobs with ✅ symbol (interview scheduled)

---

## 🚨 RED FLAGS FOR CLAUDE

If Claude starts checking:
- "Media Cause VP Creative" → **STOP** - This was rejected
- "Sincere Senior Manager" → **STOP** - This was rejected  
- Any job marked "REJECTED" → **STOP** - Don't check

If Claude lists 10+ jobs to check but only 5-7 are currently in "Apply Now" or "Applied" status → **PROBLEM** - Claude didn't filter properly

---

## ✨ EXPECTED WORKFLOW

**User:** [Copies Check Job Status Command and pastes]

**Claude:** "I'll first review your dashboard to identify which jobs to check. Let me filter out archived and rejected jobs... 

I found [X] jobs that need status verification:
- Job #3: NDWA (APPLY NOW)
- Job #13: Sollis Health (MAYBE)
- [etc]

Now checking each URL..."

**Claude:** [Checks ONLY those jobs, provides table]

**User:** [Archives closed jobs, updates dashboard as needed]

---

## 📝 SUMMARY

**Problem:** Wasted time checking 2 rejected jobs (Media Cause, Sincere)
**Solution:** Added 3 layers of filtering:
1. Explicit "CRITICAL FIRST STEP" instruction
2. Clear rejection criteria (no ❌, no "REJECTED")
3. Dynamic list generation requirement

**Result:** Claude now filters dashboard BEFORE checking URLs, saving time and focusing only on jobs that matter.
