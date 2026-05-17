'use client';

export default function PrivacyPolicy() {
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
            <h1 className="text-4xl font-bold text-gray-900 mb-6">PRIVACY POLICY</h1>
            <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
              <p className="text-gray-700 mb-2">
                <strong>Effective Date:</strong> {dateStr}
              </p>
              <p className="text-gray-700 mb-4">
                <strong>Last Updated:</strong> {dateStr}
              </p>
              <p className="text-gray-600 text-sm">
                Please also review our <a href="/terms-and-conditions" className="text-blue-600 hover:text-blue-800 font-semibold">Terms and Conditions</a> which govern your use of our services.
              </p>
            </div>
          </div>

          {/* Section 1 */}
          <section className="mb-10">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">1. Introduction</h2>
            <p className="text-gray-700 leading-relaxed">
              Medclara ("we," "us," "our," or "Company") operates a medical transcription and healthcare management platform accessible at medclara.in ("Platform"). We are committed to protecting the privacy and security of personal and health data in accordance with the Digital Personal Data Protection Act, 2023 ("DPDP Act") and applicable Indian laws.
            </p>
            <p className="text-gray-700 leading-relaxed">
              This Privacy Policy explains how we collect, use, store, share, and protect your personal data, including sensitive health information. By using our Platform, you consent to the practices described herein.
            </p>
          </section>

          {/* Section 2 */}
          <section className="mb-10">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">2. Data Fiduciary Status</h2>
            <p className="text-gray-700 leading-relaxed">
              Medclara is registered as a Data Fiduciary under the DPDP Act 2023 and accepts full legal responsibility for lawful processing of all personal data collected through our services.
            </p>
          </section>

          {/* Section 3 */}
          <section className="mb-10">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">3. Information We Collect</h2>

            <h3 className="text-xl font-semibold text-gray-800 mb-3 mt-6">3.1 Personal Information</h3>
            <ul className="list-disc list-inside text-gray-700 space-y-2 mb-4">
              <li>Name, contact details (email, phone number, address)</li>
              <li>Date of birth, age, gender</li>
              <li>Government-issued identification (Aadhaar, PAN, etc.) for verification purposes</li>
              <li>Professional credentials for healthcare providers</li>
            </ul>

            <h3 className="text-xl font-semibold text-gray-800 mb-3 mt-6">3.2 Health Information</h3>
            <ul className="list-disc list-inside text-gray-700 space-y-2 mb-4">
              <li>Medical records, diagnoses, treatment plans, prescriptions</li>
              <li>Audio recordings of medical consultations for transcription purposes</li>
              <li>Laboratory test results, imaging reports, clinical notes</li>
              <li>Medical history, allergies, medications, and vital signs</li>
              <li>Insurance information and billing records</li>
            </ul>

            <h3 className="text-xl font-semibold text-gray-800 mb-3 mt-6">3.3 Technical Information</h3>
            <ul className="list-disc list-inside text-gray-700 space-y-2">
              <li>IP addresses, device identifiers, browser type, operating system</li>
              <li>Log files, cookies, and usage analytics</li>
              <li>Access timestamps and audit trail data</li>
            </ul>
          </section>

          {/* Section 4 */}
          <section className="mb-10">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">4. Legal Basis and Purpose of Processing</h2>
            <p className="text-gray-700 leading-relaxed mb-4">We process your data based on:</p>

            <h3 className="text-xl font-semibold text-gray-800 mb-3 mt-6">4.1 Explicit Consent</h3>
            <p className="text-gray-700 leading-relaxed">
              You provide clear, specific, informed, and freely given consent for each purpose of data processing. Consent can be withdrawn at any time through your account settings or by contacting us.
            </p>

            <h3 className="text-xl font-semibold text-gray-800 mb-3 mt-6">4.2 Legitimate Medical Purposes</h3>
            <ul className="list-disc list-inside text-gray-700 space-y-2 mb-4">
              <li>Providing medical transcription services to healthcare providers</li>
              <li>Enabling hospital management and patient care coordination</li>
              <li>Medical emergencies where obtaining consent may delay critical care (as permitted under DPDP Rules 2025)</li>
              <li>Compliance with legal obligations under applicable health regulations</li>
            </ul>

            <h3 className="text-xl font-semibold text-gray-800 mb-3 mt-6">4.3 Contractual Necessity</h3>
            <p className="text-gray-700 leading-relaxed">
              To fulfill our service agreements with healthcare providers and patients
            </p>
          </section>

          {/* Section 5 */}
          <section className="mb-10">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">5. How We Use Your Information</h2>
            <ul className="list-disc list-inside text-gray-700 space-y-2">
              <li><strong>Medical Transcription:</strong> Converting audio/voice recordings of medical consultations into accurate written records</li>
              <li><strong>Healthcare Management:</strong> Maintaining electronic health records (EHRs), appointment scheduling, billing, and analytics</li>
              <li><strong>Quality Assurance:</strong> Reviewing transcription accuracy and service quality</li>
              <li><strong>Communication:</strong> Sending service notifications, appointment reminders, and important updates</li>
              <li><strong>Legal Compliance:</strong> Meeting regulatory requirements and responding to lawful requests</li>
              <li><strong>Research & Development:</strong> Improving our AI transcription models using de-identified data only with explicit consent</li>
            </ul>
          </section>

          {/* Section 6 */}
          <section className="mb-10">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">6. Data Security Measures</h2>
            <p className="text-gray-700 leading-relaxed mb-4">
              We implement reasonable security safeguards mandated by DPDP Rules 2025, including:
            </p>

            <h3 className="text-xl font-semibold text-gray-800 mb-3 mt-6">6.1 Technical Safeguards</h3>
            <ul className="list-disc list-inside text-gray-700 space-y-2 mb-4">
              <li><strong>End-to-end encryption</strong> of all health data in transit and at rest using industry-standard protocols (AES-256)</li>
              <li><strong>Data masking and tokenization</strong> for sensitive identifiers</li>
              <li><strong>Access controls</strong> with role-based permissions ensuring only authorized personnel access specific data</li>
              <li><strong>Multi-factor authentication (MFA)</strong> for all user accounts</li>
              <li><strong>Secure API gateways</strong> with JWT authentication and rate limiting</li>
            </ul>

            <h3 className="text-xl font-semibold text-gray-800 mb-3 mt-6">6.2 Organizational Safeguards</h3>
            <ul className="list-disc list-inside text-gray-700 space-y-2 mb-4">
              <li>Comprehensive <strong>audit trails</strong> logging all data access, modifications, and sharing events</li>
              <li><strong>Mandatory one-year retention</strong> of access logs for investigation purposes</li>
              <li>Regular security audits and vulnerability assessments</li>
              <li>Employee training on data protection and confidentiality obligations</li>
              <li>Incident response and disaster recovery procedures</li>
              <li><strong>Continuous monitoring</strong> systems for unauthorized access detection</li>
            </ul>

            <h3 className="text-xl font-semibold text-gray-800 mb-3 mt-6">6.3 Infrastructure Security</h3>
            <ul className="list-disc list-inside text-gray-700 space-y-2">
              <li>Data stored on secure cloud infrastructure (Google Cloud Platform) with contractual data protection obligations</li>
              <li>Geographic data residency within India as required by law</li>
              <li>Regular backups with encrypted storage</li>
              <li>Network security through firewalls and intrusion detection systems</li>
            </ul>
          </section>

          {/* Section 7 */}
          <section className="mb-10">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">7. Data Retention</h2>
            <ul className="list-disc list-inside text-gray-700 space-y-2">
              <li><strong>Active Medical Records:</strong> Retained for the duration of the patient-provider relationship plus applicable statutory periods (minimum 5 years as per Medical Council of India guidelines)</li>
              <li><strong>Transcription Audio Files:</strong> Deleted within 90 days after transcription completion unless required for quality assurance</li>
              <li><strong>Billing Records:</strong> Retained for 7 years as per tax and accounting regulations</li>
              <li><strong>Audit Logs:</strong> Retained for minimum 1 year as mandated by DPDP Rules</li>
              <li><strong>Inactive Accounts:</strong> Data anonymized or deleted after 3 years of inactivity following user notification</li>
            </ul>
          </section>

          {/* Section 8 */}
          <section className="mb-10">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">8. Data Sharing and Disclosure</h2>

            <h3 className="text-xl font-semibold text-gray-800 mb-3 mt-6">8.1 With Your Consent</h3>
            <p className="text-gray-700 leading-relaxed mb-4">
              We share your data with third parties only with your explicit consent, including:
            </p>
            <ul className="list-disc list-inside text-gray-700 space-y-2 mb-4">
              <li>Your designated healthcare providers and medical facilities</li>
              <li>Laboratories, pharmacies, and diagnostic centers as directed</li>
              <li>Insurance companies for claims processing (with explicit authorization)</li>
            </ul>

            <h3 className="text-xl font-semibold text-gray-800 mb-3 mt-6">8.2 Service Providers (Data Processors)</h3>
            <p className="text-gray-700 leading-relaxed mb-4">
              We engage third-party vendors for cloud hosting, analytics, and technical support. All vendors:
            </p>
            <ul className="list-disc list-inside text-gray-700 space-y-2 mb-4">
              <li>Execute Data Processing Agreements with security and confidentiality obligations</li>
              <li>Are contractually prohibited from using data for purposes beyond our instructions</li>
              <li>Must comply with DPDP Act requirements and maintain equivalent security standards</li>
            </ul>

            <h3 className="text-xl font-semibold text-gray-800 mb-3 mt-6">8.3 Legal Obligations</h3>
            <p className="text-gray-700 leading-relaxed mb-4">We may disclose data when required by:</p>
            <ul className="list-disc list-inside text-gray-700 space-y-2 mb-4">
              <li>Court orders, subpoenas, or legal processes</li>
              <li>Government authorities under lawful investigation</li>
              <li>Medical emergency situations where disclosure prevents serious harm</li>
            </ul>

            <h3 className="text-xl font-semibold text-gray-800 mb-3 mt-6">8.4 Business Transfers</h3>
            <p className="text-gray-700 leading-relaxed">
              In the event of merger, acquisition, or asset sale, your data may be transferred subject to the same privacy protections and with advance notice.
            </p>
          </section>

          {/* Section 9 */}
          <section className="mb-10">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">9. Your Rights Under DPDP Act 2023</h2>
            <p className="text-gray-700 leading-relaxed mb-4">You have the following rights:</p>

            <h3 className="text-xl font-semibold text-gray-800 mb-3 mt-6">9.1 Right to Access</h3>
            <p className="text-gray-700 leading-relaxed">Request copies of your personal data we hold</p>

            <h3 className="text-xl font-semibold text-gray-800 mb-3 mt-6">9.2 Right to Correction</h3>
            <p className="text-gray-700 leading-relaxed">Request correction of inaccurate or incomplete data</p>

            <h3 className="text-xl font-semibold text-gray-800 mb-3 mt-6">9.3 Right to Erasure</h3>
            <p className="text-gray-700 leading-relaxed">Request deletion of your data (subject to legal retention requirements)</p>

            <h3 className="text-xl font-semibold text-gray-800 mb-3 mt-6">9.4 Right to Data Portability</h3>
            <p className="text-gray-700 leading-relaxed">Receive your data in machine-readable format for transfer to another provider</p>

            <h3 className="text-xl font-semibold text-gray-800 mb-3 mt-6">9.5 Right to Withdraw Consent</h3>
            <p className="text-gray-700 leading-relaxed">Withdraw consent at any time (may limit service availability)</p>

            <h3 className="text-xl font-semibold text-gray-800 mb-3 mt-6">9.6 Right to Grievance Redressal</h3>
            <p className="text-gray-700 leading-relaxed">Lodge complaints with our Data Protection Officer or the Data Protection Board of India</p>

            <h3 className="text-xl font-semibold text-gray-800 mb-3 mt-6">9.7 Right to Nominate</h3>
            <p className="text-gray-700 leading-relaxed">Designate a nominee to exercise your rights in case of death or incapacity</p>

            <div className="bg-blue-50 p-4 rounded-lg border border-blue-200 mt-6">
              <p className="text-gray-700">
                <strong>To exercise these rights, contact:</strong> <a href="mailto:contact@medclara.in" className="text-blue-600 hover:text-blue-800">contact@medclara.in</a>
              </p>
            </div>
          </section>

          {/* Section 10 */}
          <section className="mb-10">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">10. Consent Management</h2>
            <ul className="list-disc list-inside text-gray-700 space-y-2">
              <li>You will be presented with clear, granular consent options for each data processing purpose</li>
              <li>Consent can be managed through your account dashboard</li>
              <li>You may opt-out of non-essential communications while continuing essential healthcare services</li>
              <li>Withdrawal of consent will be processed within 72 hours</li>
            </ul>
          </section>

          {/* Section 11 */}
          <section className="mb-10">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">11. Children's Privacy</h2>
            <p className="text-gray-700 leading-relaxed">
              For users under 18 years, we require verifiable parental/guardian consent before processing data. Parents have the right to review, modify, or delete their child's information.
            </p>
          </section>

          {/* Section 12 */}
          <section className="mb-10">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">12. Cookies and Tracking</h2>
            <p className="text-gray-700 leading-relaxed mb-4">We use cookies for:</p>
            <ul className="list-disc list-inside text-gray-700 space-y-2 mb-4">
              <li>Essential website functionality and security</li>
              <li>Analytics to improve user experience (anonymized)</li>
              <li>Session management and authentication</li>
            </ul>
            <p className="text-gray-700 leading-relaxed">
              You can manage cookie preferences through browser settings. Disabling essential cookies may impact Platform functionality.
            </p>
          </section>

          {/* Section 13 */}
          <section className="mb-10">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">13. Data Breach Notification</h2>
            <p className="text-gray-700 leading-relaxed mb-4">
              In the event of a data breach compromising your personal or health information, we will:
            </p>
            <ul className="list-disc list-inside text-gray-700 space-y-2">
              <li>Notify affected users within 72 hours of discovery</li>
              <li>Report to the Data Protection Board of India as required by law</li>
              <li>Provide details of the breach, affected data, and remedial measures taken</li>
              <li>Offer credit monitoring or identity protection services if applicable</li>
            </ul>
          </section>

          {/* Section 14 */}
          <section className="mb-10">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">14. Cross-Border Data Transfers</h2>
            <p className="text-gray-700 leading-relaxed mb-4">
              All personal data is stored within India. Any international transfers will occur only:
            </p>
            <ul className="list-disc list-inside text-gray-700 space-y-2">
              <li>With your explicit consent</li>
              <li>To countries approved by the Indian government</li>
              <li>Under Standard Contractual Clauses ensuring equivalent protection</li>
            </ul>
          </section>

          {/* Section 15 */}
          <section className="mb-10">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">15. Contact Information</h2>

            <h3 className="text-xl font-semibold text-gray-800 mb-3 mt-6">Data Protection Officer</h3>
            <div className="bg-gray-50 p-4 rounded-lg border border-gray-200 mb-6">
              <p className="text-gray-700 mb-2"><strong>Email:</strong> <a href="mailto:contact@medclara.in" className="text-blue-600 hover:text-blue-800">contact@medclara.in</a></p>
              <p className="text-gray-700 text-sm text-gray-600">Name and Phone Number to be updated</p>
            </div>

            <h3 className="text-xl font-semibold text-gray-800 mb-3 mt-6">Grievance Officer</h3>
            <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
              <p className="text-gray-700 mb-2"><strong>Email:</strong> <a href="mailto:contact@medclara.in" className="text-blue-600 hover:text-blue-800">contact@medclara.in</a></p>
              <p className="text-gray-700"><strong>Response Time:</strong> Within 7 business days</p>
            </div>
          </section>

          {/* Section 16 */}
          <section className="mb-10">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">16. Updates to This Policy</h2>
            <p className="text-gray-700 leading-relaxed">
              We may update this Privacy Policy to reflect legal changes or service enhancements. Significant changes will be notified via email and Platform notifications at least 30 days before taking effect. Continued use after changes constitutes acceptance.
            </p>
          </section>

          {/* Section 17 */}
          <section className="mb-10">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">17. Governing Law</h2>
            <p className="text-gray-700 leading-relaxed">
              This Privacy Policy is governed by the Digital Personal Data Protection Act, 2023, and applicable Indian laws. Disputes will be subject to the exclusive jurisdiction of courts in India.
            </p>
          </section>

          {/* Section 18 */}
          <section className="mb-10">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">18. Compliance Certifications</h2>
            <p className="text-gray-700 leading-relaxed mb-4">
              Medclara maintains the following compliance standards:
            </p>
            <ul className="list-disc list-inside text-gray-700 space-y-2">
              <li>ISO 27001:2022 (Information Security Management)</li>
              <li>DPDP Act 2023 Registration Number: [To be updated]</li>
              <li>Regular Data Protection Impact Assessments (DPIA)</li>
            </ul>
          </section>

          {/* Closing Statement */}
          <div className="bg-blue-50 p-6 rounded-lg border border-blue-200 mt-12">
            <p className="text-gray-900 font-semibold text-center mb-4">
              By using Medclara's services, you acknowledge that you have read, understood, and agree to this Privacy Policy.
            </p>
            <p className="text-gray-700 text-center text-sm">
              Please also review our <a href="/terms-and-conditions" className="text-blue-600 hover:text-blue-800 font-semibold">Terms and Conditions</a> which govern your use of our services.
            </p>
          </div>

        </article>
      </div>
    </div>
  );
}
