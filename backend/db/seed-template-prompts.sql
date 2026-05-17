-- Medclara Backend: Seed Template-Specific Analysis Prompts
-- This script populates the 'prompt' field for all clinical templates
-- Run with: psql "$DATABASE_URL" < scripts/seed-template-prompts.sql

-- ============================================
-- GENERAL MEDICINE & PRIMARY CARE PROMPTS
-- ============================================

-- SOAP Note (General) - soap-general
UPDATE templates SET prompt = '1. **Patient Summary:**
   - Provide a brief overview of the patient (e.g., age, gender, relevant background) as mentioned in the transcript as a paragraph, Only mention things that are there in the transcript, no assumption.
   - Summarize the chief complaint or primary reason for the visit.

2. **Presented Symptoms:**
   - List all symptoms reported by the patient in bullet points.
   - For each symptom, include:
     - Description (e.g., onset, duration, severity, location, aggravating/alleviating factors).
     - Any associated details from the doctor''s questions or patient''s responses (e.g., frequency, progression).
   - Group related symptoms logically (e.g., respiratory, gastrointestinal).

3. **Medical History and Examination Findings:**
   - Extract any mentioned past medical history, family history, medications, allergies, or social history (e.g., smoking, diet).
   - Note any physical examination findings, vital signs, or tests discussed in the transcript.

4. **Possible Diagnoses:**
   - List possible differential diagnoses based on the doctor''s explicit suggestions. DONOT make a diagnosis yourself!
   - For each diagnosis:
     - Provide the full medical name and a brief layperson explanation.
     - Include any supporting or ruling-out factors mentioned (e.g., "Less likely due to absence of Z symptom").
   - If the doctor provides a primary diagnosis, highlight it and explain the rationale.

5. **Doctor''s Recommendations and Next Steps:**
   - Summarize any advice, tests, treatments, or follow-ups suggested by the doctor in the transcript.'
WHERE template_key = 'soap-general';

-- H&P (Comprehensive History & Physical) - hp-comprehensive
UPDATE templates SET prompt = '1. **Patient Summary:**
   - Provide a comprehensive demographic and background overview as mentioned in the transcript.
   - Include age, gender, occupation, and other relevant social context.
   - Summarize the chief complaint and the reasons for this comprehensive evaluation.

2. **History of Present Illness:**
   - Detailed chronological account of the presenting problem.
   - Onset, duration, severity, character, location, and associated symptoms.
   - What makes it better or worse; impact on daily activities.

3. **Past Medical History:**
   - All significant past medical illnesses and conditions mentioned.
   - Include chronic conditions, previous hospitalizations, and surgeries.
   - Order by relevance to current complaint.

4. **Past Surgical History:**
   - Date and type of any surgical procedures mentioned.
   - Indications for surgery and outcomes.

5. **Medications and Allergies:**
   - Complete list of current medications with dosages as mentioned.
   - All drug allergies and adverse reactions with specific details.

6. **Family History:**
   - Significant family medical history relevant to patient''s condition.
   - Family members'' illnesses, particularly genetic or heritable conditions.

7. **Social History:**
   - Occupation, living situation, social support system.
   - Tobacco, alcohol, and substance use patterns.
   - Sexual history if relevant to presenting complaint.

8. **Review of Systems:**
   - Systematic inquiry through body systems based on transcript discussion.
   - Focus on systems relevant to chief complaint.

9. **Physical Examination Findings:**
   - Vital signs (temperature, blood pressure, heart rate, respiratory rate).
   - General appearance and mental status.
   - Organ system findings organized by system.

10. **Assessment and Plan:**
    - Synthesis of history and physical findings.
    - Differential diagnosis and reasoning.
    - Plan for additional workup and treatment as discussed.'
WHERE template_key = 'hp-comprehensive';

-- Office Visit Note - office-visit
UPDATE templates SET prompt = '1. **Chief Complaint:**
   - Brief statement of reason for visit as stated by patient.

2. **Interval History:**
   - What has happened to the patient since last visit.
   - Any new or ongoing symptoms.
   - Changes in medications or compliance.

3. **Vital Signs:**
   - Current vital signs if measured during visit.

4. **Physical Examination:**
   - Focused examination findings relevant to chief complaint.
   - Include vital organ findings and any abnormalities noted.

5. **Assessment and Plan:**
   - Summary of current clinical status.
   - Any new diagnoses or changes to existing diagnoses.
   - Current management plan and any changes.
   - Patient education provided.

6. **Counseling and Patient Education:**
   - What was discussed with patient regarding condition and management.
   - Preventive health topics covered.'
WHERE template_key = 'office-visit';

-- Acute Illness/Urgent Care Note - acute-illness
UPDATE templates SET prompt = '1. **Chief Complaint:**
   - Primary reason for urgent evaluation.

2. **History of Present Illness:**
   - When did symptoms start; what has happened since onset.
   - Severity and impact on functioning.
   - What brought patient in today (why now).
   - Associated symptoms.

3. **Relevant Past Medical History:**
   - Any previous similar episodes or related conditions.
   - Current chronic conditions that may be relevant.

4. **Vital Signs and Initial Assessment:**
   - All vital signs obtained on presentation.
   - Overall appearance and acuity level.

5. **Physical Examination:**
   - Focused physical examination findings related to presenting problem.
   - Any abnormal findings or red flags identified.

6. **Differential Diagnosis:**
   - List of possible diagnoses being considered based on presentation.
   - Most likely diagnosis(es) based on clinical assessment.

7. **Diagnostic Workup and Results:**
   - Any tests or studies ordered or performed.
   - Results and interpretation if available.

8. **Assessment and Clinical Impression:**
   - Overall summary of the acute condition.
   - Severity and risk stratification.

9. **Treatment Plan:**
   - Medications prescribed or administered.
   - Procedures or interventions performed.
   - Disposition (discharge, hospitalization, referral).

10. **Follow-up Instructions:**
    - When and how to follow up with primary care.
    - Red flag symptoms requiring immediate return.
    - Any restrictions or activity limitations.'
WHERE template_key = 'acute-illness';

-- Chronic Disease Management - chronic-disease-mgmt
UPDATE templates SET prompt = '1. **Chief Complaint:**
   - Brief statement of visit purpose.

2. **Interval History:**
   - How patient has been managing their chronic condition since last visit.
   - Control of symptoms; any acute exacerbations or problems.
   - Changes in symptoms, functional status, or impact on quality of life.

3. **Medication Compliance:**
   - Current medications and patient''s adherence to regimen.
   - Any side effects or reasons for non-compliance.
   - Any new medications started or discontinued.

4. **Symptom Control Assessment:**
   - How well the condition is being controlled.
   - Patient''s perception of symptom burden and functional impact.
   - Changes from last visit.

5. **Vital Signs and Physical Examination:**
   - Relevant vital signs and focused examination findings.
   - Signs of disease progression or improvement.

6. **Recent Laboratory and Test Results:**
   - Results of any recent lab work or studies relevant to chronic disease.
   - Trends over time if available.

7. **Assessment:**
   - Current status of chronic disease(s).
   - Degree of control; any complications noted.

8. **Medication Adjustments and Therapy Changes:**
   - Any changes made to current medication regimen.
   - Rationale for changes and expected benefits.

9. **Preventive Screening:**
   - Any preventive screening tests discussed or recommended.

10. **Patient Education:**
    - What was discussed regarding disease management, lifestyle modifications.
    - Adherence support and resources provided.

11. **Follow-up Plan:**
    - When patient should return for follow-up.
    - Any specialist referrals planned.'
WHERE template_key = 'chronic-disease-mgmt';

-- Preventive Care / Annual Physical - preventive-care
UPDATE templates SET prompt = '1. **Vital Signs:**
   - All vital signs obtained during visit.
   - Comparison to previous measurements if available.

2. **General Examination Findings:**
   - General appearance, nutritional status, mental status.
   - Comprehensive physical examination by system.

3. **Interval History:**
   - Changes in health status since last annual visit.
   - New symptoms or concerns.
   - Life changes that may impact health.

4. **Lifestyle Assessment:**
   - Current exercise and diet habits.
   - Tobacco, alcohol, and substance use.
   - Stress level and coping mechanisms.

5. **Immunization Status:**
   - Current immunizations up to date.
   - Any vaccines recommended or administered today.

6. **Cancer Screening Results:**
   - Results of any cancer screening tests (mammography, colonoscopy, etc.).
   - Dates of last screening and recommendations for future screening.

7. **Other Screening Results:**
   - Results of screening labs (lipid panel, glucose, etc.).
   - Any abnormal findings identified.

8. **Cardiovascular and Metabolic Risk Assessment:**
   - Assessment of cardiovascular risk factors.
   - Metabolic syndrome evaluation if indicated.

9. **Health Counseling:**
   - Topics discussed related to disease prevention.
   - Recommendations for healthy lifestyle modifications.

10. **Assessment and Plan:**
    - Overall health status assessment.
    - Any new health concerns identified or diagnosed.
    - Plan for addressing identified health risks.
    - Any referrals to specialists or additional testing recommended.'
WHERE template_key = 'preventive-care';

-- ============================================
-- SPECIALIZED CONSULTATIONS PROMPTS
-- ============================================

-- Consultation Note - consultation-note
UPDATE templates SET prompt = '1. **Consultation Request:**
   - Reason for consultation as stated by referring provider.
   - Specific questions or issues the referring provider wants addressed.

2. **Referring Provider Information:**
   - Name and specialty of referring provider.

3. **Brief History of Present Illness:**
   - Concise summary of the presenting problem.
   - Relevant context for specialist evaluation.

4. **Relevant Past Medical History:**
   - Conditions relevant to the consultation request.
   - Previous treatments attempted.

5. **Vital Signs and Relevant Examination Findings:**
   - Vital signs and any focused examination findings.
   - Relevant objective data supporting consultation.

6. **Relevant Laboratory and Imaging Results:**
   - Key test results or imaging studies reviewed.
   - Findings that inform specialist assessment.

7. **Assessment:**
   - Specialist''s clinical impression of the problem.
   - Differential diagnosis if applicable.

8. **Recommendations:**
   - Specific recommendations for management.
   - Suggestions for diagnostic workup.
   - Treatment recommendations.

9. **Follow-up:**
   - When and how the specialist should follow up with patient.
   - Communication plan with referring provider.'
WHERE template_key = 'consultation-note';

-- Follow-up Visit Note - follow-up-visit
UPDATE templates SET prompt = '1. **Chief Complaint:**
   - Brief statement of reason for follow-up visit.

2. **Summary of Previous Visit:**
   - Key findings and plan from previous encounter.
   - Diagnoses being followed.

3. **Interval History:**
   - What has happened since last visit.
   - Response to treatments initiated.
   - Any new or persistent symptoms.

4. **Compliance Assessment:**
   - How well patient is following recommended treatment plan.
   - Any barriers to compliance.

5. **Vital Signs and Physical Examination:**
   - Current vital signs and focused examination.
   - Changes from previous visit.

6. **Test Results:**
   - Results of any tests ordered since last visit.
   - Trends in key measurements.

7. **Assessment:**
   - Update on all active medical problems.
   - Progress toward treatment goals.

8. **Updated Plan:**
   - Any changes to current management plan.
   - New medications or interventions.
   - Adjustments to existing therapies.'
WHERE template_key = 'follow-up-visit';

-- Hospital Admission Note - hospital-admission
UPDATE templates SET prompt = '1. **Admission Diagnosis:**
   - Primary reason for hospital admission.

2. **History of Present Illness:**
   - Detailed account of events leading to hospitalization.
   - Symptom timeline and severity.
   - Reason why hospitalization was deemed necessary.

3. **Past Medical History:**
   - All significant medical conditions.
   - Previous hospitalizations or surgeries relevant to current admission.

4. **Current Medications and Allergies:**
   - All medications patient was taking at home.
   - All drug allergies and adverse reactions.

5. **Social History:**
   - Relevant social factors affecting hospitalization.

6. **Physical Examination Findings:**
   - Comprehensive physical examination findings on admission.
   - Vital signs and general status.

7. **Initial Laboratory and Diagnostic Studies:**
   - Results of labs and imaging obtained on admission.
   - Key findings guiding initial management.

8. **Assessment and Impression:**
   - Preliminary diagnostic impression based on presentation.
   - Differential diagnosis.

9. **Hospital Admission Plan:**
   - Planned workup and management during hospitalization.
   - Tests or procedures anticipated.
   - Consultations requested.'
WHERE template_key = 'hospital-admission';

-- Hospital Discharge Summary - discharge-summary
UPDATE templates SET prompt = '1. **Admission and Discharge Diagnoses:**
   - Reason for admission.
   - Final diagnoses at time of discharge.
   - Any new diagnoses made during hospitalization.

2. **Hospital Course:**
   - Summary of patient''s clinical course during hospitalization.
   - Key events, complications, or improvements.
   - Response to treatments.

3. **Procedures Performed:**
   - Any surgical or diagnostic procedures during hospitalization.
   - Indications and results.

4. **Final Examination Findings:**
   - Patient''s physical status at discharge.
   - Vital signs and clinical status.

5. **Discharge Laboratory and Imaging Results:**
   - Final lab values and key imaging results.
   - Comparison to admission if relevant.

6. **Discharge Medications:**
   - All medications patient is prescribed at discharge.
   - New medications started; medications discontinued.

7. **Medication Changes:**
   - Clear documentation of what changed from admission to discharge.
   - Rationale for medication changes.

8. **Discharge Instructions:**
   - Activity restrictions or recommendations.
   - Wound care or other self-care instructions.
   - Diet restrictions or recommendations.

9. **Follow-up Plan:**
   - When patient should follow up with primary care.
   - Any specialist follow-up needed.
   - When test results will be available or communicated.

10. **Clinician Communication:**
    - How referring/primary care physician was notified of discharge.
    - Any urgent issues communicated.'
WHERE template_key = 'discharge-summary';

-- ============================================
-- PROCEDURE NOTES PROMPTS
-- ============================================

-- Procedure Note - procedure-note
UPDATE templates SET prompt = '1. **Procedure Name:**
   - Name of procedure performed.

2. **Indication:**
   - Medical reason for performing this procedure.
   - Relevant clinical context.

3. **Pre-Procedure Assessment:**
   - Patient''s pre-procedure status.
   - Relevant findings or test results.
   - Informed consent process.

4. **Anesthesia:**
   - Type of anesthesia or sedation used if applicable.
   - Dosages and response.

5. **Procedure Technique:**
   - Detailed description of how procedure was performed.
   - Equipment used.
   - Approach and method.

6. **Findings:**
   - What was found during the procedure.
   - Anatomical findings or pathology identified.
   - Description of abnormalities if any.

7. **Specimens:**
   - Any specimens obtained for pathology.
   - How specimens were handled and labeled.

8. **Complications:**
   - Any intra-procedure complications encountered.
   - How complications were managed.

9. **Post-Procedure Status:**
   - Patient''s condition immediately after procedure.
   - Tolerability of procedure.

10. **Recommendations:**
    - Any follow-up procedures or interventions needed.
    - Patient education provided.'
WHERE template_key = 'procedure-note';

-- Injection/Procedure Note - injection-note
UPDATE templates SET prompt = '1. **Injection Type:**
   - Type of injection or procedure performed (steroid injection, nerve block, etc.).

2. **Anatomical Site:**
   - Exact location of injection or procedure.
   - Anatomical landmarks used for guidance.

3. **Indication:**
   - Medical reason for the injection.
   - Symptom or diagnosis being treated.

4. **Pre-Injection Assessment:**
   - Patient''s baseline pain or symptom level.
   - Relevant clinical findings.

5. **Injection Technique:**
   - Ultrasound or fluoroscopic guidance if used.
   - Approach and entry point.
   - Confirmation of correct location.

6. **Medications Used:**
   - Specific medications injected.
   - Dosages used.

7. **Number of Needle Passes:**
   - How many attempts or needle passes required.
   - Ease of procedure.

8. **Patient Response During Procedure:**
   - Patient''s tolerance and any immediate response.
   - Pain elicited during injection if relevant.

9. **Post-Injection Instructions:**
   - Activity restrictions.
   - Expected timeline for symptom improvement.
   - When to contact provider if symptoms worsen.'
WHERE template_key = 'injection-note';

-- ============================================
-- MENTAL HEALTH & BEHAVIORAL PROMPTS
-- ============================================

-- Mental Health Intake Evaluation - mental-health-intake
UPDATE templates SET prompt = '1. **Chief Complaint:**
   - Primary reason patient is seeking mental health evaluation.

2. **History of Present Illness:**
   - When did current mental health concerns begin.
   - Symptoms and their progression.
   - Impact on functioning and quality of life.
   - Precipitating events or stressors.

3. **Psychiatric History:**
   - Previous psychiatric diagnoses or treatment.
   - Previous hospitalizations for psychiatric reasons.
   - Previous medications tried and effectiveness.
   - Previous therapy or counseling experience.

4. **Family Psychiatric History:**
   - Family history of mental health conditions.
   - Family history of substance abuse or suicide.

5. **Substance Use History:**
   - Current and past alcohol use.
   - Current and past drug use.
   - Tobacco use.
   - Frequency, quantity, and impact on life.

6. **Trauma and Abuse History:**
   - History of physical, emotional, or sexual abuse.
   - History of trauma or PTSD.

7. **Social History:**
   - Living situation and social support.
   - Work or school status.
   - Significant relationships.
   - Recreational activities and interests.

8. **Mental Status Examination:**
   - Appearance and behavior.
   - Mood and affect.
   - Speech and thought process.
   - Thought content including suicidal or homicidal ideation.
   - Cognition and insight.

9. **Safety Assessment:**
   - Current suicidal or homicidal ideation.
   - Past suicide attempts or self-harm.
   - Access to means.
   - Current safety planning.

10. **Assessment and Treatment Plan:**
    - Diagnostic impressions.
    - Recommended treatment approach.
    - Medications if appropriate.
    - Referrals for specialized treatment.'
WHERE template_key = 'mental-health-intake';

-- Mental Status Examination - mental-status-exam
UPDATE templates SET prompt = '1. **Appearance:**
   - Physical appearance, grooming, cleanliness.
   - Notable features or behaviors.

2. **Behavior:**
   - General level of activity (hyperactive, withdrawn, etc.).
   - Mannerisms and gestures.
   - Appropriateness to context.

3. **Attitude:**
   - Patient''s attitude toward examiner (cooperative, hostile, suspicious, etc.).
   - Eye contact and engagement.

4. **Mood:**
   - Patient''s stated mood (subjective).
   - Mood as observed by examiner (objective).

5. **Affect:**
   - Appropriate, depressed, elevated, labile, or restricted.
   - Congruence with stated mood.

6. **Speech:**
   - Rate, volume, tone, and quality.
   - Spontaneity and coherence.
   - Evidence of pressured speech or poverty of speech.

7. **Thought Process:**
   - Organization and logical flow of thoughts.
   - Presence of tangentiality, flight of ideas, or loosening of associations.

8. **Thought Content:**
   - Delusions if present and their nature.
   - Suicidal or homicidal ideation or plans.
   - Preoccupations or obsessions.

9. **Perception:**
   - Hallucinations or illusions if present.
   - Type and content of perceptual abnormalities.

10. **Cognition:**
    - Level of consciousness and orientation to person, place, time.
    - Memory (immediate, short-term, long-term).
    - Attention and concentration.
    - Intelligence and fund of knowledge.

11. **Judgment and Insight:**
    - Ability to make sound decisions.
    - Understanding of current situation and need for treatment.'
WHERE template_key = 'mental-status-exam';

-- Psychotherapy Session Note - psychotherapy-note
UPDATE templates SET prompt = '1. **Session Date and Duration:**
   - Date of session and how long it lasted.

2. **Patient Presentation:**
   - How patient appeared and their mood when arriving.
   - Any notable changes from previous sessions.

3. **Session Summary:**
   - Main topics discussed in session.
   - Issues patient brought up or therapist addressed.
   - Themes that emerged.

4. **Therapeutic Interventions:**
   - Specific therapy techniques or interventions used.
   - Questions asked or reflections provided.
   - Homework or exercises assigned.

5. **Emotional Process:**
   - Patient''s emotional reactions during session.
   - Depth of engagement with material.
   - Resistance or blocks that emerged.

6. **Insight Gained:**
   - Realizations or understandings patient came to.
   - Shifts in perspective or thinking.

7. **Homework or Between-Session Assignments:**
   - Specific work patient agreed to do between sessions.
   - Readings or exercises assigned.

8. **Progress Toward Treatment Goals:**
   - How patient is progressing toward identified goals.
   - Positive changes or continued challenges.

9. **Clinical Impression and Next Steps:**
   - Therapist''s assessment of session and patient''s progress.
   - Any changes to treatment plan.
   - Focus for next session.'
WHERE template_key = 'psychotherapy-note';

-- ============================================
-- REHABILITATION & THERAPY PROMPTS
-- ============================================

-- Physical Therapy Initial Evaluation - pt-initial-eval
UPDATE templates SET prompt = '1. **Chief Complaint:**
   - Primary reason for physical therapy referral.

2. **History of Injury or Condition:**
   - How injury occurred or when condition started.
   - Mechanism of injury if applicable.
   - Relevant circumstances.

3. **Prior Treatment:**
   - Any previous physical therapy or medical treatment.
   - Response to previous interventions.

4. **Pain Assessment:**
   - Current pain level on 0-10 scale if mentioned.
   - Location and character of pain.
   - What makes pain better or worse.

5. **Functional Status:**
   - Current functional limitations.
   - Abilities and disabilities in daily activities.
   - Impact on work, hobbies, and life activities.

6. **Physical Examination Findings:**
   - Posture and alignment.
   - Range of motion findings.
   - Strength testing results.
   - Special tests performed and results.

7. **Imaging or Prior Test Results Review:**
   - Any relevant imaging or test results reviewed.

8. **Assessment:**
   - Physical therapist''s assessment of impairments and functional limitations.
   - Likely diagnosis or classification.

9. **Treatment Plan:**
   - Specific goals for rehabilitation.
   - Planned interventions and modalities.
   - Frequency and duration of therapy.

10. **Discharge Goals:**
    - Long-term goals and expected outcomes.
    - Anticipated timeline for discharge.'
WHERE template_key = 'pt-initial-eval';

-- Physical Therapy Treatment Note - pt-treatment-note
UPDATE templates SET prompt = '1. **Chief Complaint:**
   - How patient is doing today regarding their condition.

2. **Subjective Report:**
   - Patient''s report of pain, function, and progress since last session.
   - Any new symptoms or concerns.
   - Compliance with home exercise program.

3. **Vital Signs:**
   - Vital signs if obtained.

4. **Range of Motion Assessment:**
   - Active and passive range of motion findings.
   - Changes from previous session.

5. **Strength Testing:**
   - Manual muscle testing results.
   - Changes in strength.

6. **Special Tests:**
   - Results of any special tests performed.
   - Reproduction of symptoms if relevant.

7. **Treatment Performed:**
   - Specific modalities and interventions used in session.
   - Exercises performed.
   - Manual therapy techniques if applicable.

8. **Patient Response:**
   - How patient tolerated treatment.
   - Changes in symptoms during or after treatment.

9. **Home Program:**
   - Review and update of home exercise program.
   - Patient understanding and ability to perform exercises.

10. **Progress:**
    - Progress toward established goals.
    - Functional improvements noted.

11. **Plan:**
    - Plan for continued treatment.
    - Any changes to treatment approach.
    - When patient should return.'
WHERE template_key = 'pt-treatment-note';

-- Occupational Therapy Initial Evaluation - ot-initial-eval
UPDATE templates SET prompt = '1. **Reason for Referral:**
   - Primary reason OT evaluation was requested.

2. **Occupational History:**
   - Patient''s work history and current employment status.
   - Meaningful activities and roles in life.

3. **ADL Status (Activities of Daily Living):**
   - Ability to perform self-care tasks (bathing, dressing, toileting, etc.).
   - Independence level and assistive devices needed.

4. **IADL Status (Instrumental Activities of Daily Living):**
   - Ability to perform household tasks, cooking, shopping, etc.
   - Independence level and current difficulties.

5. **Work Status and Demands:**
   - Current work demands and physical/cognitive requirements.
   - Work-related concerns or limitations.

6. **Functional Limitations:**
   - Specific limitations affecting occupational performance.

7. **Cognitive Assessment:**
   - Cognition related to functional tasks.
   - Memory, attention, problem-solving ability relevant to occupations.

8. **Sensorimotor Findings:**
   - Hand function and grip strength.
   - Coordination and balance.
   - Sensation if relevant.

9. **Environmental Assessment:**
   - Home and work environment barriers.
   - Accessibility considerations.

10. **Assessment:**
    - OT assessment of occupational performance and limitations.
    - Factors contributing to disability.

11. **Treatment Goals:**
    - Specific functional goals for OT intervention.
    - Expected outcomes and timeline.'
WHERE template_key = 'ot-initial-eval';

-- ============================================
-- SPECIALTY-SPECIFIC PROMPTS
-- ============================================

-- Cardiology Note - cardiology-note
UPDATE templates SET prompt = '1. **Chief Complaint:**
   - Reason for cardiology consultation or visit.

2. **History of Cardiac Symptoms:**
   - Description of chest pain, shortness of breath, palpitations, etc.
   - Onset, duration, precipitating and relieving factors.
   - Associated symptoms.

3. **Cardiac Risk Factors:**
   - Hypertension, diabetes, hyperlipidemia, smoking.
   - Family history of heart disease.
   - Previous coronary disease or cardiac events.

4. **Medication Review:**
   - Current cardiac medications and doses.
   - Other relevant medications.

5. **Vital Signs:**
   - Blood pressure, heart rate, respiratory rate.
   - Orthostatic vital signs if relevant.

6. **Cardiac Physical Examination:**
   - Heart rate and rhythm.
   - Heart sounds and murmurs.
   - Signs of heart failure (edema, JVD, etc.).

7. **Pulmonary Examination:**
   - Lung sounds, presence of crackles or wheezes.
   - Signs of pulmonary edema.

8. **EKG Results:**
   - EKG findings if obtained.
   - Abnormalities or changes noted.

9. **Echocardiogram Results:**
   - Echo findings if available.
   - Ejection fraction and wall motion.
   - Valve disease or other structural findings.

10. **Laboratory Results:**
    - Troponin, BNP, or other cardiac markers.
    - Lipid panel results.

11. **Assessment:**
    - Cardiology assessment and impressions.

12. **Plan:**
    - Medications prescribed or changed.
    - Lifestyle recommendations.
    - Further workup planned.'
WHERE template_key = 'cardiology-note';

-- Dermatology Note - dermatology-note
UPDATE templates SET prompt = '1. **Chief Complaint:**
   - Skin condition or concern prompting visit.

2. **History:**
   - When the skin condition started.
   - Changes over time.
   - What makes it better or worse.
   - Associated symptoms (itching, pain, drainage, etc.).

3. **Skin-Related Medical History:**
   - Previous skin conditions or treatments.
   - History of allergies or sensitivities.
   - Reactions to skincare products.

4. **Medication Use:**
   - Topical medications currently used.
   - Oral medications that might affect skin.

5. **Skin Examination:**
   - Description of primary skin lesion(s).
   - Location, size, color, and characteristics.
   - Distribution pattern.
   - Associated findings.

6. **Scalp and Hair Examination:**
   - Scalp condition if relevant.
   - Hair loss patterns or abnormalities.

7. **Nail Examination:**
   - Nail appearance and abnormalities if relevant.

8. **Mucous Membrane Examination:**
   - Oral mucosa, lips, or genital findings if relevant.

9. **Assessment:**
    - Dermatologic diagnosis or differential diagnosis.

10. **Treatment Plan:**
    - Topical treatments prescribed.
    - Oral medications if applicable.
    - Procedures or referrals if needed.'
WHERE template_key = 'dermatology-note';

-- Orthopedic Note - orthopedic-note
UPDATE templates SET prompt = '1. **Chief Complaint:**
   - Orthopedic issue prompting visit (pain, injury, limitation, etc.).

2. **Injury History:**
   - How injury occurred or when symptoms started.
   - Mechanism and severity of injury.

3. **Prior Treatment:**
   - Previous orthopedic care or interventions.
   - Response to treatment.

4. **Pain and Functional Limitations:**
   - Pain location, severity, and character.
   - Activities limited by condition.

5. **Vital Signs and General Status:**
   - Vital signs if obtained.
   - General appearance and how patient moves.

6. **Affected Joint/Area Examination:**
   - Inspection: swelling, deformity, skin changes.
   - Palpation: tenderness, crepitus, alignment.
   - Range of motion: active and passive.
   - Strength testing.
   - Special orthopedic tests performed and results.

7. **Neurovascular Examination:**
   - Distal pulses and circulation.
   - Sensation and motor function distal to injury.
   - Signs of neurovascular compromise.

8. **Imaging Review:**
   - X-rays, MRI, or CT findings if available.
   - Fractures, soft tissue injuries, or degenerative changes.

9. **Assessment:**
   - Orthopedic diagnosis or differential.

10. **Treatment Plan:**
    - Conservative treatment (rest, ice, compression, elevation).
    - Physical therapy recommendations.
    - Medications or injections if indicated.
    - Need for surgical intervention if considered.'
WHERE template_key = 'orthopedic-note';

-- Rheumatology Note - rheumatology-note
UPDATE templates SET prompt = '1. **Chief Complaint:**
   - Rheumatologic concern or symptom.

2. **Joint Symptoms History:**
   - Which joints involved and pattern of involvement.
   - Symmetry and distribution.
   - Duration and progression of symptoms.

3. **Systemic Symptoms:**
   - Fever, fatigue, weight loss, or other systemic findings.
   - Impact on functioning.

4. **Joint Examination:**
   - Warmth, swelling, erythema, or deformity of joints.
   - Range of motion and function.

5. **Laboratory and Serology Results:**
   - Rheumatoid factor, anti-CCP, ANA, complement levels.
   - Inflammatory markers (ESR, CRP).
   - Other relevant serology.

6. **Imaging Findings:**
   - X-ray findings showing joint damage or erosions.
   - MRI or ultrasound findings if available.

7. **Assessment:**
    - Rheumatologic diagnosis or differential.
    - Disease activity assessment.

8. **DMARD Plan (Disease-Modifying Antirheumatic Drugs):**
    - Current DMARDs and doses.
    - Any changes to medications.
    - Treatment goals and monitoring plan.'
WHERE template_key = 'rheumatology-note';

-- Endocrinology Note - endocrinology-note
UPDATE templates SET prompt = '1. **Chief Complaint:**
   - Endocrine concern (diabetes management, thyroid issues, etc.).

2. **Endocrine/Metabolic History:**
   - Duration of endocrine condition.
   - Prior treatments and responses.
   - Related complications if applicable.

3. **Diabetes Control (if applicable):**
   - Blood glucose monitoring patterns.
   - Current insulin or oral agent regimen.
   - Episodes of hypoglycemia or hyperglycemia.

4. **Medication Adherence:**
   - How well patient is taking prescribed medications.
   - Barriers to compliance.

5. **Laboratory Results:**
   - Hemoglobin A1C or other relevant labs.
    - Thyroid function tests if applicable.
    - Other endocrine markers.

6. **Physical Examination Findings:**
   - Weight, BMI, vital signs.
   - Exam findings relevant to endocrine condition.

7. **Assessment:**
    - Assessment of disease control and complications.

8. **Treatment Adjustments:**
    - Changes to medications or doses.
    - Referrals to other services if needed.
    - Lifestyle and dietary recommendations.'
WHERE template_key = 'endocrinology-note';

-- Pulmonology Note - pulmonology-note
UPDATE templates SET prompt = '1. **Chief Complaint:**
   - Pulmonary symptom or concern (cough, shortness of breath, etc.).

2. **Respiratory History:**
   - When symptoms started and progression.
   - Associated symptoms.
   - Impact on activities and quality of life.

3. **Smoking History:**
   - Current and past smoking status.
   - Pack-year history.

4. **Pulmonary Examination:**
   - Breath sounds (normal, decreased, absent, wheezes, crackles).
   - Accessory muscle use or signs of respiratory distress.

5. **Pulmonary Function Test Results:**
   - FEV1, FVC, and other PFT parameters if available.
   - Obstruction, restriction, or other patterns.

6. **Imaging Results:**
   - Chest X-ray findings if available.
   - CT chest findings if obtained.

7. **Assessment:**
    - Pulmonary diagnosis or differential.

8. **Management Plan:**
    - Medications prescribed (inhalers, biologics, etc.).
    - Oxygen therapy if needed.
    - Pulmonary rehabilitation referral.
    - Follow-up studies planned.'
WHERE template_key = 'pulmonology-note';

-- ============================================
-- ADMINISTRATIVE & REPORTS PROMPTS
-- ============================================

-- Referral Letter - referral-letter
UPDATE templates SET prompt = '1. **Patient Information:**
   - Patient name, date of birth, medical record number.

2. **Referring Provider:**
   - Name and specialty of referring provider.

3. **Reason for Referral:**
   - Primary reason for specialist consultation.
   - Specific questions or concerns referring provider has.

4. **Clinical History:**
   - Brief relevant medical history.
   - Timeline of symptoms or condition.

5. **Current Diagnoses:**
   - Active diagnoses relevant to referral.

6. **Current Medications:**
   - Relevant medications patient is taking.

7. **Allergies:**
   - Any drug or other allergies.

8. **Recent Test Results:**
   - Key laboratory or imaging results.

9. **Urgency:**
   - Indication of urgency level (routine, urgent, emergent).

10. **Requested Workup or Interventions:**
    - Specific evaluations or treatments being requested.'
WHERE template_key = 'referral-letter';

-- Disability Form - disability-form
UPDATE templates SET prompt = '1. **Patient Information:**
   - Name, date of birth, contact information.

2. **Disability Dates:**
   - Proposed start date and estimated end date of disability.
   - Expected duration.

3. **Medical Diagnosis:**
   - Primary diagnosis necessitating disability.
   - Other relevant medical conditions.

4. **Functional Limitations:**
   - Specific functional limitations caused by condition.
   - How condition impacts work ability.

5. **Work Restrictions:**
   - Specific restrictions recommended.
   - Activities patient cannot perform.
   - Limitations on hours worked or physical demands.

6. **Expected Duration:**
   - How long restrictions are expected to last.
   - Anticipated recovery timeline.

7. **Recovery Plan:**
   - Plan for rehabilitation or recovery.
   - When reassessment may occur.

8. **Work Accommodations:**
   - Suggested workplace modifications or accommodations.
   - Alternative duties if applicable.'
WHERE template_key = 'disability-form';

-- Work/School Excuse Note - work-excuse
UPDATE templates SET prompt = '1. **Patient Information:**
   - Name and date of visit.

2. **Diagnosis:**
   - Medical diagnosis requiring time off work or school.

3. **Restriction or Recommendation:**
   - Whether patient should not work/attend school, or modified duty.
   - Specific restrictions if applicable.

4. **Duration:**
   - Length of time excuse is valid.

5. **Return Date:**
   - Date patient may return to work or school.'
WHERE template_key = 'work-excuse';

-- ============================================
-- Completion Message
-- ============================================

-- Display summary
SELECT template_key, label, 
       CASE WHEN prompt IS NOT NULL AND LENGTH(TRIM(prompt)) > 0 THEN 'Prompt Set' ELSE 'No Prompt' END as status
FROM templates
WHERE is_active = true
ORDER BY specialty, label;
