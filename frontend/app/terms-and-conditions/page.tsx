'use client';

export default function TermsAndConditions() {
  const today = new Date();
  const dateStr = today.toLocaleDateString('en-IN', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  return (
    <div className="min-h-screen bg-white py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        <article className="prose prose-sm sm:prose lg:prose-lg max-w-none">
          {/* Header */}
          <div className="mb-12">
            <h1 className="text-4xl font-bold text-gray-900 mb-6">TERMS AND CONDITIONS</h1>
            <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
              <p className="text-gray-700 mb-2">
                <strong>Effective Date:</strong> {dateStr}
              </p>
              <p className="text-gray-700 mb-4">
                <strong>Last Updated:</strong> {dateStr}
              </p>
              <p className="text-gray-600 text-sm">
                Please also review our <a href="/privacy-policy" className="text-blue-600 hover:text-blue-800 font-semibold">Privacy Policy</a> which governs our treatment of personal data and health information.
              </p>
            </div>
          </div>

          {/* Section 1 */}
          <section className="mb-10">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">1. Acceptance of Terms</h2>
            <p className="text-gray-700 leading-relaxed">
              These Terms and Conditions ("Terms") constitute a legal agreement between you ("User," "Patient," "Healthcare Provider," or "You") and Medclara ("we," "us," "our," or "Company"), governing your access to and use of our medical transcription and healthcare management platform accessible at medclara.in ("Platform").
            </p>
            <p className="text-gray-700 leading-relaxed mt-4">
              By accessing, registering with, or using the Platform in any manner, you agree to be bound by these Terms, our Privacy Policy, and all applicable laws and regulations. If you do not agree to these Terms, please do not use the Platform.
            </p>
          </section>

          {/* Section 2 */}
          <section className="mb-10">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">2. Use License</h2>
            <p className="text-gray-700 leading-relaxed">
              Medclara grants you a limited, non-exclusive, non-transferable, revocable license to access and use the Platform solely for lawful purposes in accordance with these Terms. You may not:
            </p>
            <ul className="list-disc list-inside text-gray-700 space-y-2 mt-4">
              <li>Reproduce, duplicate, copy, or sell any portion of the Platform</li>
              <li>Attempt to gain unauthorized access to restricted portions of the Platform</li>
              <li>Transmit viruses, malware, or any code of destructive nature</li>
              <li>Collect or track personal information of others without consent</li>
              <li>Spam, phish, or engage in any fraudulent or deceptive practices</li>
              <li>Violate any applicable laws, regulations, or these Terms</li>
              <li>Harass, abuse, or threaten other users or Platform staff</li>
              <li>Use automated tools, scripts, or bots to access the Platform without authorization</li>
            </ul>
          </section>

          {/* Section 3 */}
          <section className="mb-10">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">3. User Registration and Accounts</h2>

            <h3 className="text-xl font-semibold text-gray-800 mb-3 mt-6">3.1 Registration Requirements</h3>
            <p className="text-gray-700 leading-relaxed">
              To use certain features of the Platform, you must create an account. You agree to:
            </p>
            <ul className="list-disc list-inside text-gray-700 space-y-2 mt-3 mb-4">
              <li>Provide accurate, complete, and current information</li>
              <li>Maintain the confidentiality of your password and account credentials</li>
              <li>Accept responsibility for all activities occurring under your account</li>
              <li>Notify us immediately of unauthorized account access</li>
            </ul>

            <h3 className="text-xl font-semibold text-gray-800 mb-3 mt-6">3.2 Eligibility</h3>
            <p className="text-gray-700 leading-relaxed">
              You must be at least 18 years old to use the Platform. For users under 18, a parent or legal guardian must create and manage the account. Medclara reserves the right to verify your identity and age at any time.
            </p>

            <h3 className="text-xl font-semibold text-gray-800 mb-3 mt-6">3.3 Account Termination</h3>
            <p className="text-gray-700 leading-relaxed">
              Medclara may suspend or terminate your account if you violate these Terms, engage in unlawful conduct, or for any reason at our sole discretion with 30 days' notice (except in cases of emergency or serious violations).
            </p>
          </section>

          {/* Section 4 */}
          <section className="mb-10">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">4. Medical Transcription Services</h2>

            <h3 className="text-xl font-semibold text-gray-800 mb-3 mt-6">4.1 Service Description</h3>
            <p className="text-gray-700 leading-relaxed">
              Medclara provides AI-powered and human-assisted medical transcription services, converting audio recordings of medical consultations into written records. Our services are designed to support healthcare providers and patients but do not replace professional medical judgment or diagnosis.
            </p>

            <h3 className="text-xl font-semibold text-gray-800 mb-3 mt-6">4.2 Accuracy and Limitations</h3>
            <p className="text-gray-700 leading-relaxed">
              While we strive for high accuracy in transcription, errors may occur. You agree to:
            </p>
            <ul className="list-disc list-inside text-gray-700 space-y-2 mt-3 mb-4">
              <li>Review all transcriptions for accuracy before clinical use</li>
              <li>Not rely solely on AI transcriptions for medical decision-making</li>
              <li>Maintain professional medical judgment and quality control</li>
              <li>Report errors promptly for correction</li>
            </ul>

            <h3 className="text-xl font-semibold text-gray-800 mb-3 mt-6">4.3 Audio Recording Consent</h3>
            <p className="text-gray-700 leading-relaxed">
              Healthcare providers must obtain explicit informed consent from patients before recording medical consultations. Medclara is not responsible for consent management; this is the sole responsibility of the healthcare provider.
            </p>
          </section>

          {/* Section 5 */}
          <section className="mb-10">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">5. Health Data and Privacy</h2>

            <h3 className="text-xl font-semibold text-gray-800 mb-3 mt-6">5.1 DPDP Act Compliance</h3>
            <p className="text-gray-700 leading-relaxed">
              All personal and health data processing is governed by the Digital Personal Data Protection Act, 2023 ("DPDP Act"), our Privacy Policy, and applicable healthcare regulations. Healthcare providers are joint data controllers and must establish data processing agreements with Medclara.
            </p>

            <h3 className="text-xl font-semibold text-gray-800 mb-3 mt-6">5.2 Health Information Security</h3>
            <p className="text-gray-700 leading-relaxed">
              You acknowledge that health information is sensitive and requires heightened security. We implement encryption, access controls, and audit logging. However, no system is completely secure, and we cannot guarantee absolute security.
            </p>

            <h3 className="text-xl font-semibold text-gray-800 mb-3 mt-6">5.3 User Responsibility</h3>
            <p className="text-gray-700 leading-relaxed">
              Users are responsible for:
            </p>
            <ul className="list-disc list-inside text-gray-700 space-y-2 mt-3">
              <li>Maintaining confidentiality of login credentials</li>
              <li>Using the Platform only for authorized purposes</li>
              <li>Complying with all applicable healthcare and privacy laws</li>
              <li>Not sharing patient data with unauthorized parties through the Platform</li>
            </ul>
          </section>

          {/* Section 6 */}
          <section className="mb-10">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">6. Intellectual Property Rights</h2>

            <h3 className="text-xl font-semibold text-gray-800 mb-3 mt-6">6.1 Platform Ownership</h3>
            <p className="text-gray-700 leading-relaxed">
              The Platform, including all content, features, functionality, software, design, and intellectual property (collectively, "Platform Materials") are owned by or licensed to Medclara. You retain no rights to Platform Materials except as expressly granted in these Terms.
            </p>

            <h3 className="text-xl font-semibold text-gray-800 mb-3 mt-6">6.2 Your Content</h3>
            <p className="text-gray-700 leading-relaxed">
              You retain ownership of your medical records and health data uploaded to the Platform. By using our services, you grant Medclara a limited license to use your data solely for providing transcription and healthcare management services as described.
            </p>

            <h3 className="text-xl font-semibold text-gray-800 mb-3 mt-6">6.3 AI Model Training</h3>
            <p className="text-gray-700 leading-relaxed">
              Medclara may use anonymized and de-identified transcription data to improve AI transcription models, with your explicit consent only. You can opt-out through your account settings.
            </p>
          </section>

          {/* Section 7 */}
          <section className="mb-10">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">7. Service Fees and Payment</h2>

            <h3 className="text-xl font-semibold text-gray-800 mb-3 mt-6">7.1 Pricing</h3>
            <p className="text-gray-700 leading-relaxed">
              Pricing for services will be clearly displayed before purchase. Fees are non-refundable except as required by law or as specified in our refund policy.
            </p>

            <h3 className="text-xl font-semibold text-gray-800 mb-3 mt-6">7.2 Payment Processing</h3>
            <p className="text-gray-700 leading-relaxed">
              We use third-party payment processors to handle transactions. By providing payment information, you consent to the sharing of data with these processors in accordance with our Privacy Policy.
            </p>

            <h3 className="text-xl font-semibold text-gray-800 mb-3 mt-6">7.3 Billing Disputes</h3>
            <p className="text-gray-700 leading-relaxed">
              Report billing disputes within 30 days. We will investigate and resolve disputes in good faith. Disputed amounts should not be withheld from payment without our agreement.
            </p>
          </section>

          {/* Section 8 */}
          <section className="mb-10">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">8. Limitation of Liability</h2>

            <h3 className="text-xl font-semibold text-gray-800 mb-3 mt-6">8.1 Disclaimer</h3>
            <p className="text-gray-700 leading-relaxed">
              THE PLATFORM AND SERVICES ARE PROVIDED "AS IS" AND "AS AVAILABLE" WITHOUT ANY WARRANTIES, EXPRESS OR IMPLIED. MEDCLARA DISCLAIMS ALL IMPLIED WARRANTIES, INCLUDING MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, AND NON-INFRINGEMENT.
            </p>

            <h3 className="text-xl font-semibold text-gray-800 mb-3 mt-6">8.2 Limitation of Damages</h3>
            <p className="text-gray-700 leading-relaxed">
              TO THE MAXIMUM EXTENT PERMITTED BY LAW, MEDCLARA'S TOTAL LIABILITY ARISING FROM THESE TERMS OR USE OF THE PLATFORM SHALL NOT EXCEED THE AMOUNT PAID BY YOU TO MEDCLARA IN THE 12 MONTHS PRECEDING THE CLAIM.
            </p>

            <h3 className="text-xl font-semibold text-gray-800 mb-3 mt-6">8.3 Exclusion of Consequential Damages</h3>
            <p className="text-gray-700 leading-relaxed">
              IN NO EVENT SHALL MEDCLARA BE LIABLE FOR INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, INCLUDING LOSS OF PROFITS, DATA, OR BUSINESS INTERRUPTION, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGES.
            </p>

            <h3 className="text-xl font-semibold text-gray-800 mb-3 mt-6">8.4 Medical Liability</h3>
            <p className="text-gray-700 leading-relaxed">
              Medclara's services support healthcare providers but do not replace professional medical judgment. Medclara is not liable for medical outcomes, adverse events, or misdiagnosis arising from transcription errors or service failures.
            </p>
          </section>

          {/* Section 9 */}
          <section className="mb-10">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">9. Indemnification</h2>
            <p className="text-gray-700 leading-relaxed">
              You agree to indemnify, defend, and hold harmless Medclara and its officers, directors, employees, and agents from any claims, damages, losses, liabilities, and expenses arising from:
            </p>
            <ul className="list-disc list-inside text-gray-700 space-y-2 mt-4">
              <li>Your violation of these Terms or applicable laws</li>
              <li>Your use of the Platform in unauthorized ways</li>
              <li>Your content, data, or medical records uploaded to the Platform</li>
              <li>Claims by third parties regarding your use of the Platform</li>
              <li>Your failure to obtain proper patient consent for recording or sharing</li>
            </ul>
          </section>

          {/* Section 10 */}
          <section className="mb-10">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">10. Availability and Uptime</h2>

            <h3 className="text-xl font-semibold text-gray-800 mb-3 mt-6">10.1 Service Availability</h3>
            <p className="text-gray-700 leading-relaxed">
              We aim to maintain 99.5% uptime for the Platform, excluding scheduled maintenance and events beyond our control. We are not liable for downtime or service interruptions.
            </p>

            <h3 className="text-xl font-semibold text-gray-800 mb-3 mt-6">10.2 Maintenance</h3>
            <p className="text-gray-700 leading-relaxed">
              We may perform scheduled maintenance with 48 hours' notice. During maintenance, the Platform may be unavailable.
            </p>

            <h3 className="text-xl font-semibold text-gray-800 mb-3 mt-6">10.3 Emergency Access</h3>
            <p className="text-gray-700 leading-relaxed">
              In medical emergencies, patients have the right to access their health records and transcriptions without delay, even if account issues exist. Contact our emergency support line for immediate assistance.
            </p>
          </section>

          {/* Section 11 */}
          <section className="mb-10">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">11. Third-Party Services and Links</h2>

            <h3 className="text-xl font-semibold text-gray-800 mb-3 mt-6">11.1 Third-Party Integrations</h3>
            <p className="text-gray-700 leading-relaxed">
              The Platform may integrate with or link to third-party services (electronic health record systems, payment processors, etc.). We are not responsible for these third-party services, their privacy practices, or content.
            </p>

            <h3 className="text-xl font-semibold text-gray-800 mb-3 mt-6">11.2 Your Responsibility</h3>
            <p className="text-gray-700 leading-relaxed">
              You are solely responsible for reviewing third-party terms, privacy policies, and security practices. Use of third-party services is at your own risk.
            </p>
          </section>

          {/* Section 12 */}
          <section className="mb-10">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">12. Dispute Resolution</h2>

            <h3 className="text-xl font-semibold text-gray-800 mb-3 mt-6">12.1 Governing Law</h3>
            <p className="text-gray-700 leading-relaxed">
              These Terms are governed by the laws of India, including the Digital Personal Data Protection Act, 2023, and applicable healthcare regulations. You consent to the exclusive jurisdiction of courts in India.
            </p>

            <h3 className="text-xl font-semibold text-gray-800 mb-3 mt-6">12.2 Grievance Redressal</h3>
            <p className="text-gray-700 leading-relaxed">
              Before pursuing legal action, you agree to first contact our Grievance Officer at <a href="mailto:contact@medclara.in" className="text-blue-600 hover:text-blue-800">contact@medclara.in</a>. We will attempt to resolve disputes within 30 days.
            </p>

            <h3 className="text-xl font-semibold text-gray-800 mb-3 mt-6">12.3 Mediation and Arbitration</h3>
            <p className="text-gray-700 leading-relaxed">
              If informal resolution fails, disputes may be submitted to mediation or arbitration under Indian Arbitration and Conciliation Act, 1996. Both parties agree to arbitration as final resolution method.
            </p>
          </section>

          {/* Section 13 */}
          <section className="mb-10">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">13. Prohibited Conduct</h2>
            <p className="text-gray-700 leading-relaxed">
              You agree not to engage in any of the following activities:
            </p>
            <ul className="list-disc list-inside text-gray-700 space-y-2 mt-4">
              <li>Accessing or attempting to access unauthorized areas of the Platform</li>
              <li>Interfering with Platform functionality or security measures</li>
              <li>Reverse engineering, decompiling, or disassembling Platform code</li>
              <li>Uploading or sharing illegal content, malware, or harmful materials</li>
              <li>Harassment, threats, or abusive behavior toward others</li>
              <li>Impersonating healthcare providers or Medclara staff</li>
              <li>Violating any applicable laws, regulations, or healthcare standards</li>
              <li>Reselling, redistributing, or commercial use of Platform access</li>
            </ul>
          </section>

          {/* Section 14 */}
          <section className="mb-10">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">14. Changes to Terms</h2>
            <p className="text-gray-700 leading-relaxed">
              Medclara may update these Terms at any time. Material changes will be notified via email or prominent Platform announcements at least 30 days before taking effect. Continued use after changes constitutes acceptance.
            </p>
          </section>

          {/* Section 15 */}
          <section className="mb-10">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">15. Severability</h2>
            <p className="text-gray-700 leading-relaxed">
              If any provision of these Terms is found to be unenforceable or invalid, that provision will be modified to the minimum extent necessary to make it valid, or if not possible, severed. The remaining provisions will remain in effect.
            </p>
          </section>

          {/* Section 16 */}
          <section className="mb-10">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">16. Entire Agreement</h2>
            <p className="text-gray-700 leading-relaxed">
              These Terms, together with our <a href="/privacy-policy" className="text-blue-600 hover:text-blue-800 font-semibold">Privacy Policy</a>, Data Processing Agreements, and any other documents incorporated by reference, constitute the entire agreement between you and Medclara regarding the Platform. These Terms supersede all prior agreements, understandings, and representations.
            </p>
          </section>

          {/* Section 17 */}
          <section className="mb-10">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">17. Contact Information</h2>

            <h3 className="text-xl font-semibold text-gray-800 mb-3 mt-6">For Inquiries and Support</h3>
            <div className="bg-gray-50 p-4 rounded-lg border border-gray-200 mb-6">
              <p className="text-gray-700 mb-2"><strong>Email:</strong> <a href="mailto:support@medclara.in" className="text-blue-600 hover:text-blue-800">support@medclara.in</a></p>
              <p className="text-gray-700">Contact details to be updated with phone and address</p>
            </div>

            <h3 className="text-xl font-semibold text-gray-800 mb-3 mt-6">Grievance Resolution</h3>
            <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
              <p className="text-gray-700 mb-2"><strong>Email:</strong> <a href="mailto:contact@medclara.in" className="text-blue-600 hover:text-blue-800">contact@medclara.in</a></p>
              <p className="text-gray-700"><strong>Response Time:</strong> Within 7 business days</p>
            </div>
          </section>

          {/* Closing Statement */}
          <div className="bg-blue-50 p-6 rounded-lg border border-blue-200 mt-12">
            <p className="text-gray-900 font-semibold text-center mb-4">
              By using Medclara's services, you acknowledge that you have read, understood, and agree to these Terms and Conditions.
            </p>
            <p className="text-gray-700 text-center text-sm">
              Please also review our <a href="/privacy-policy" className="text-blue-600 hover:text-blue-800 font-semibold">Privacy Policy</a> for information on how we handle your personal and health data.
            </p>
          </div>
        </article>
      </div>
    </div>
  );
}
