import type { User, Lead, Activity, EmailMessage, Deal, AISuggestion, EmailSequence, Campaign } from '@/types/crm';

export const mockUsers: User[] = [
  { id: 'u1', name: 'Sarah Chen', email: 'sarah@integrateapi.ai', role: 'admin' },
  { id: 'u2', name: 'Marcus Rivera', email: 'marcus@integrateapi.ai', role: 'employee' },
  { id: 'u3', name: 'Aisha Patel', email: 'aisha@integrateapi.ai', role: 'employee' },
];

export const mockLeads: Lead[] = [
  { id: 'l1', firstName: 'David', lastName: 'Thornton', email: 'dthornton@meridiantech.com', phone: '+14155551234', jobTitle: 'VP of Engineering', company: 'Meridian Technologies', companySize: '201-500', industry: 'SaaS', location: 'San Francisco, CA', status: 'warm', assignedTo: 'u2', createdAt: '2025-12-01T09:00:00Z', lastContactedAt: '2026-03-18T14:30:00Z', notes: 'Interested in our enterprise API tier', tags: ['enterprise', 'high-value'], linkedinUrl: 'https://linkedin.com/in/dthornton' },
  { id: 'l2', firstName: 'Rachel', lastName: 'Kimura', email: 'rkimura@vantagehealth.io', phone: '+12125559876', jobTitle: 'CTO', company: 'Vantage Health', companySize: '51-200', industry: 'Healthcare', location: 'New York, NY', status: 'cold', assignedTo: 'u2', createdAt: '2026-01-15T10:00:00Z', lastContactedAt: null, notes: '', tags: ['healthcare', 'mid-market'], linkedinUrl: 'https://linkedin.com/in/rkimura' },
  { id: 'l3', firstName: 'Tom', lastName: 'Vasquez', email: 'tom.v@bluelinelogistics.com', phone: '+13125554567', jobTitle: 'Director of IT', company: 'BlueLine Logistics', companySize: '501-1000', industry: 'Logistics', location: 'Chicago, IL', status: 'lukewarm', assignedTo: 'u3', createdAt: '2026-01-20T08:00:00Z', lastContactedAt: '2026-03-10T11:00:00Z', notes: 'Asked for a demo next week', tags: ['logistics', 'demo-scheduled'] },
  { id: 'l4', firstName: 'Nadia', lastName: 'Okonkwo', email: 'nokonkwo@firestartventures.co', phone: '+14085553210', jobTitle: 'CEO', company: 'Firestart Ventures', companySize: '11-50', industry: 'Venture Capital', location: 'Palo Alto, CA', status: 'warm', assignedTo: 'u2', createdAt: '2026-02-01T09:00:00Z', lastContactedAt: '2026-03-20T16:00:00Z', notes: 'Looking to integrate with their portfolio companies', tags: ['vc', 'partnership'] },
  { id: 'l5', firstName: 'James', lastName: 'Hargrove', email: 'jhargrove@steelcitymanuf.com', phone: '+14125558900', jobTitle: 'Operations Manager', company: 'Steel City Manufacturing', companySize: '1001-5000', industry: 'Manufacturing', location: 'Pittsburgh, PA', status: 'dead', assignedTo: 'u3', createdAt: '2025-11-10T07:00:00Z', lastContactedAt: '2026-01-05T09:00:00Z', notes: 'No budget until Q3', tags: ['manufacturing'] },
  { id: 'l6', firstName: 'Elena', lastName: 'Marchetti', email: 'emarchetti@prismadata.eu', phone: '+442071234567', jobTitle: 'Head of Product', company: 'Prisma Data', companySize: '51-200', industry: 'Data Analytics', location: 'London, UK', status: 'cold', assignedTo: 'u2', createdAt: '2026-02-14T12:00:00Z', lastContactedAt: null, notes: '', tags: ['international', 'data'] },
  { id: 'l7', firstName: 'Kevin', lastName: 'Park', email: 'kpark@orbitalai.com', phone: '+16505557777', jobTitle: 'Co-Founder', company: 'Orbital AI', companySize: '11-50', industry: 'AI/ML', location: 'Mountain View, CA', status: 'warm', assignedTo: 'u3', createdAt: '2026-02-20T15:00:00Z', lastContactedAt: '2026-03-19T10:00:00Z', notes: 'Wants custom integration support', tags: ['ai', 'startup'] },
  { id: 'l8', firstName: 'Lisa', lastName: 'Brennan', email: 'lbrennan@northstarfinance.com', phone: '+12125551111', jobTitle: 'VP of Technology', company: 'NorthStar Finance', companySize: '201-500', industry: 'Fintech', location: 'New York, NY', status: 'lukewarm', assignedTo: 'u2', createdAt: '2026-03-01T08:00:00Z', lastContactedAt: '2026-03-15T13:00:00Z', notes: 'Compliance review in progress', tags: ['fintech', 'compliance'] },
  { id: 'l9', firstName: 'Omar', lastName: 'Sayeed', email: 'osayeed@crescentmedia.co', phone: '+17135559999', jobTitle: 'Digital Director', company: 'Crescent Media', companySize: '51-200', industry: 'Media', location: 'Houston, TX', status: 'cold', assignedTo: 'u3', createdAt: '2026-03-05T10:00:00Z', lastContactedAt: null, notes: '', tags: ['media'] },
  { id: 'l10', firstName: 'Hannah', lastName: 'Nguyen', email: 'hnguyen@terraverde.io', phone: '+15035552222', jobTitle: 'CTO', company: 'TerraVerde', companySize: '11-50', industry: 'CleanTech', location: 'Portland, OR', status: 'warm', assignedTo: 'u2', createdAt: '2026-03-08T14:00:00Z', lastContactedAt: '2026-03-21T09:00:00Z', notes: 'Excited about API-first approach', tags: ['cleantech', 'startup'] },
  { id: 'l11', firstName: 'Carlos', lastName: 'Mendez', email: 'cmendez@quantumleap.dev', phone: '+13055553333', jobTitle: 'Engineering Lead', company: 'Quantum Leap Dev', companySize: '51-200', industry: 'Software', location: 'Miami, FL', status: 'lukewarm', assignedTo: 'u3', createdAt: '2026-03-10T11:00:00Z', lastContactedAt: '2026-03-17T15:00:00Z', notes: 'Evaluating competitors', tags: ['software', 'competitive'] },
  { id: 'l12', firstName: 'Priya', lastName: 'Sharma', email: 'psharma@nexusretail.com', phone: '+14695554444', jobTitle: 'VP of Digital', company: 'Nexus Retail Group', companySize: '1001-5000', industry: 'Retail', location: 'Dallas, TX', status: 'cold', assignedTo: 'u2', createdAt: '2026-03-12T09:00:00Z', lastContactedAt: null, notes: '', tags: ['retail', 'enterprise'] },
  { id: 'l13', firstName: 'Ben', lastName: 'Whitaker', email: 'bwhitaker@summitcloud.io', phone: '+12065555555', jobTitle: 'Solutions Architect', company: 'Summit Cloud', companySize: '201-500', industry: 'Cloud Infrastructure', location: 'Seattle, WA', status: 'dead', assignedTo: 'u3', createdAt: '2025-10-01T08:00:00Z', lastContactedAt: '2025-12-20T10:00:00Z', notes: 'Went with competitor', tags: ['cloud', 'lost'] },
  { id: 'l14', firstName: 'Maya', lastName: 'Foster', email: 'mfoster@brightpath.edu', phone: '+16175556666', jobTitle: 'Director of Technology', company: 'BrightPath Education', companySize: '51-200', industry: 'EdTech', location: 'Boston, MA', status: 'lukewarm', assignedTo: 'u2', createdAt: '2026-03-14T10:00:00Z', lastContactedAt: '2026-03-20T11:00:00Z', notes: 'Needs bulk API access for student platform', tags: ['edtech'] },
  { id: 'l15', firstName: 'Ryan', lastName: 'Callahan', email: 'rcallahan@ironforge.io', phone: '+13035557777', jobTitle: 'CEO', company: 'IronForge Systems', companySize: '11-50', industry: 'Cybersecurity', location: 'Denver, CO', status: 'warm', assignedTo: 'u3', createdAt: '2026-03-15T13:00:00Z', lastContactedAt: '2026-03-22T09:00:00Z', notes: 'Interested in SOC2-compliant API layer', tags: ['cybersecurity', 'startup'] },
  { id: 'l16', firstName: 'Jenna', lastName: 'Liu', email: 'jliu@canvasdesign.co', phone: '+14155558888', jobTitle: 'Head of Engineering', company: 'Canvas Design Co', companySize: '51-200', industry: 'Design', location: 'San Francisco, CA', status: 'cold', assignedTo: 'u2', createdAt: '2026-03-16T08:00:00Z', lastContactedAt: null, notes: '', tags: ['design'] },
  { id: 'l17', firstName: 'Andre', lastName: 'Brooks', email: 'abrooks@veloxauto.com', phone: '+13135559999', jobTitle: 'Innovation Lead', company: 'Velox Automotive', companySize: '5001-10000', industry: 'Automotive', location: 'Detroit, MI', status: 'lukewarm', assignedTo: 'u3', createdAt: '2026-03-17T07:00:00Z', lastContactedAt: '2026-03-21T14:00:00Z', notes: 'Connected vehicle API use case', tags: ['automotive', 'enterprise'] },
  { id: 'l18', firstName: 'Sophie', lastName: 'Durand', email: 'sdurand@lumenrx.com', phone: '+16465550000', jobTitle: 'CTO', company: 'LumenRx', companySize: '201-500', industry: 'Pharma', location: 'New York, NY', status: 'warm', assignedTo: 'u2', createdAt: '2026-03-18T11:00:00Z', lastContactedAt: '2026-03-22T16:00:00Z', notes: 'HIPAA-compliant API needs', tags: ['pharma', 'compliance'] },
  { id: 'l19', firstName: 'Tyler', lastName: 'Grant', email: 'tgrant@peakperform.fit', phone: '+15105551234', jobTitle: 'Founder', company: 'PeakPerform', companySize: '1-10', industry: 'Fitness Tech', location: 'Oakland, CA', status: 'cold', assignedTo: 'u3', createdAt: '2026-03-19T09:00:00Z', lastContactedAt: null, notes: '', tags: ['fitness', 'startup'] },
  { id: 'l20', firstName: 'Diana', lastName: 'Kowalski', email: 'dkowalski@atlasship.com', phone: '+12165555678', jobTitle: 'VP of Operations', company: 'Atlas Shipping', companySize: '501-1000', industry: 'Shipping', location: 'Cleveland, OH', status: 'dead', assignedTo: 'u2', createdAt: '2025-09-15T08:00:00Z', lastContactedAt: '2025-11-30T10:00:00Z', notes: 'Not a fit for current offering', tags: ['shipping'] },
  { id: 'l21', firstName: 'Kai', lastName: 'Tanaka', email: 'ktanaka@waveenergy.co', phone: '+18085556789', jobTitle: 'Technical Director', company: 'Wave Energy Corp', companySize: '51-200', industry: 'Energy', location: 'Honolulu, HI', status: 'warm', assignedTo: 'u3', createdAt: '2026-03-20T10:00:00Z', lastContactedAt: '2026-03-22T08:00:00Z', notes: 'IoT sensor API integration', tags: ['energy', 'iot'] },
  { id: 'l22', firstName: 'Megan', lastName: 'Russo', email: 'mrusso@civicworks.gov', phone: '+12025550101', jobTitle: 'IT Director', company: 'CivicWorks Solutions', companySize: '201-500', industry: 'GovTech', location: 'Washington, DC', status: 'lukewarm', assignedTo: 'u2', createdAt: '2026-03-21T08:00:00Z', lastContactedAt: '2026-03-22T12:00:00Z', notes: 'Government procurement process', tags: ['govtech', 'procurement'] },
];

export const mockActivities: Activity[] = [
  { id: 'a1', leadId: 'l1', userId: 'u2', type: 'call', description: 'Discussed enterprise pricing tier. David is interested but needs board approval.', timestamp: '2026-03-18T14:30:00Z' },
  { id: 'a2', leadId: 'l1', userId: 'u2', type: 'email_sent', description: 'Sent pricing comparison document', timestamp: '2026-03-16T10:00:00Z' },
  { id: 'a3', leadId: 'l1', userId: 'u2', type: 'email_received', description: 'David replied with questions about SLA terms', timestamp: '2026-03-17T09:15:00Z' },
  { id: 'a4', leadId: 'l1', userId: 'u2', type: 'note', description: 'Board meeting scheduled for March 25th — follow up after', timestamp: '2026-03-18T15:00:00Z' },
  { id: 'a5', leadId: 'l3', userId: 'u3', type: 'call', description: 'Scheduled product demo for next Tuesday', timestamp: '2026-03-10T11:00:00Z' },
  { id: 'a6', leadId: 'l3', userId: 'u3', type: 'email_sent', description: 'Sent demo calendar invite and prep materials', timestamp: '2026-03-10T11:30:00Z' },
  { id: 'a7', leadId: 'l4', userId: 'u2', type: 'call', description: 'Nadia wants to pilot with 3 portfolio companies', timestamp: '2026-03-20T16:00:00Z' },
  { id: 'a8', leadId: 'l4', userId: 'u2', type: 'status_change', description: 'Status changed from lukewarm to warm', timestamp: '2026-03-20T16:15:00Z' },
  { id: 'a9', leadId: 'l7', userId: 'u3', type: 'email_sent', description: 'Sent custom integration documentation', timestamp: '2026-03-19T10:00:00Z' },
  { id: 'a10', leadId: 'l10', userId: 'u2', type: 'call', description: 'Hannah loves the API-first approach. Wants to start a trial.', timestamp: '2026-03-21T09:00:00Z' },
  { id: 'a11', leadId: 'l15', userId: 'u3', type: 'email_sent', description: 'Sent SOC2 compliance documentation', timestamp: '2026-03-22T09:00:00Z' },
  { id: 'a12', leadId: 'l18', userId: 'u2', type: 'call', description: 'Discussed HIPAA requirements and data residency', timestamp: '2026-03-22T16:00:00Z' },
  { id: 'a13', leadId: 'l8', userId: 'u2', type: 'email_sent', description: 'Follow-up on compliance review timeline', timestamp: '2026-03-15T13:00:00Z' },
  { id: 'a14', leadId: 'l11', userId: 'u3', type: 'call', description: 'Carlos comparing us with two other vendors', timestamp: '2026-03-17T15:00:00Z' },
  { id: 'a15', leadId: 'l21', userId: 'u3', type: 'email_sent', description: 'Sent IoT integration use case whitepaper', timestamp: '2026-03-22T08:00:00Z' },
];

export const mockEmails: EmailMessage[] = [
  // Thread 1: David Thornton — Enterprise pricing
  { id: 'e1', leadId: 'l1', from: 'marcus@integrateapi.ai', to: 'dthornton@meridiantech.com', subject: 'Enterprise API Pricing — IntegrateAPI', body: 'Hi David,\n\nFollowing up on our call. Attached is the pricing comparison for our Enterprise tier. The plan includes dedicated support, custom SLA terms, and priority API access.\n\nLet me know if you have any questions.\n\nBest,\nMarcus', sentAt: '2026-03-16T10:00:00Z', read: true, direction: 'outbound', threadId: 't1' },
  { id: 'e2', leadId: 'l1', from: 'dthornton@meridiantech.com', to: 'marcus@integrateapi.ai', subject: 'Re: Enterprise API Pricing — IntegrateAPI', body: 'Marcus,\n\nThanks for sending this over. A couple questions:\n\n1. What does the SLA guarantee in terms of uptime?\n2. Is there flexibility on the per-seat pricing for teams over 50?\n3. Can we get a 30-day trial before committing?\n\nAppreciate it,\nDavid', sentAt: '2026-03-17T09:15:00Z', read: true, direction: 'inbound', threadId: 't1', replyToId: 'e1' },
  { id: 'e2b', leadId: 'l1', from: 'marcus@integrateapi.ai', to: 'dthornton@meridiantech.com', subject: 'Re: Enterprise API Pricing — IntegrateAPI', body: 'David,\n\nGreat questions.\n\n1. Our SLA guarantees 99.95% uptime with credits for any downtime.\n2. For teams over 50, we offer volume discounts — I can put together a custom quote.\n3. Absolutely, we can set up a 30-day enterprise trial.\n\nWant me to draft a custom proposal for your team?\n\nMarcus', sentAt: '2026-03-17T14:30:00Z', read: true, direction: 'outbound', threadId: 't1', replyToId: 'e2' },
  { id: 'e2c', leadId: 'l1', from: 'dthornton@meridiantech.com', to: 'marcus@integrateapi.ai', subject: 'Re: Enterprise API Pricing — IntegrateAPI', body: 'Marcus,\n\nYes, please go ahead with the custom proposal. We have 62 developers who would need access. Our board meeting is March 25th so timing works well.\n\nDavid', sentAt: '2026-03-18T08:45:00Z', read: false, direction: 'inbound', threadId: 't1', replyToId: 'e2b' },

  // Thread 2: Tom Vasquez — Demo
  { id: 'e3', leadId: 'l3', from: 'aisha@integrateapi.ai', to: 'tom.v@bluelinelogistics.com', subject: 'Demo Confirmation — IntegrateAPI', body: 'Hi Tom,\n\nConfirming our demo for Tuesday at 2 PM CT. I\'ve attached some prep materials covering our logistics API integrations.\n\nLooking forward to it!\n\nAisha', sentAt: '2026-03-10T11:30:00Z', read: true, direction: 'outbound', threadId: 't2' },
  { id: 'e3b', leadId: 'l3', from: 'tom.v@bluelinelogistics.com', to: 'aisha@integrateapi.ai', subject: 'Re: Demo Confirmation — IntegrateAPI', body: 'Aisha,\n\nPerfect, see you Tuesday. I\'ll have our head of fleet operations join as well — he\'s the one who\'d be using the real-time tracking APIs most.\n\nTom', sentAt: '2026-03-10T15:20:00Z', read: true, direction: 'inbound', threadId: 't2', replyToId: 'e3' },

  // Thread 3: Kevin Park — Custom integration
  { id: 'e4', leadId: 'l7', from: 'aisha@integrateapi.ai', to: 'kpark@orbitalai.com', subject: 'Custom Integration Docs — IntegrateAPI', body: 'Kevin,\n\nHere are the integration docs we discussed. The custom webhook section on page 12 should cover your ML pipeline use case.\n\nLet me know if you need anything else.\n\nAisha', sentAt: '2026-03-19T10:00:00Z', read: true, direction: 'outbound', threadId: 't3' },
  { id: 'e4b', leadId: 'l7', from: 'kpark@orbitalai.com', to: 'aisha@integrateapi.ai', subject: 'Re: Custom Integration Docs — IntegrateAPI', body: 'Aisha,\n\nThis is exactly what I needed. One question — does the webhook system support batched payloads? We push ~10k events per minute during peak training runs.\n\nKevin', sentAt: '2026-03-20T11:00:00Z', read: false, direction: 'inbound', threadId: 't3', replyToId: 'e4' },

  // Thread 4: Apollo.io (no lead)
  { id: 'e5', from: 'support@apolloio.com', to: 'sarah@integrateapi.ai', subject: 'Your Apollo.io API usage report', body: 'Hi Sarah,\n\nHere is your weekly API usage summary:\n\n• Total calls: 12,847\n• Success rate: 99.2%\n• Rate limit hits: 3\n\nYou\'re approaching 80% of your monthly quota. Consider upgrading for uninterrupted access.\n\nApollo.io Team', sentAt: '2026-03-22T06:00:00Z', read: false, direction: 'inbound', threadId: 't4' },

  // Thread 5: Ryan Callahan — SOC2
  { id: 'e6', leadId: 'l15', from: 'aisha@integrateapi.ai', to: 'rcallahan@ironforge.io', subject: 'SOC2 Compliance Documentation', body: 'Ryan,\n\nAs promised, here is our SOC2 compliance documentation. We completed Type II certification in January 2026.\n\nHappy to set up a call with our security team if you want to dig deeper.\n\nAisha', sentAt: '2026-03-22T09:00:00Z', read: true, direction: 'outbound', threadId: 't5' },
  { id: 'e6b', leadId: 'l15', from: 'rcallahan@ironforge.io', to: 'aisha@integrateapi.ai', subject: 'Re: SOC2 Compliance Documentation', body: 'Aisha,\n\nThis looks solid. Yes, I\'d love to get our CISO on a call with your security team. How does Thursday afternoon look?\n\nRyan', sentAt: '2026-03-22T14:30:00Z', read: false, direction: 'inbound', threadId: 't5', replyToId: 'e6' },

  // Thread 6: Lisa Brennan — Compliance
  { id: 'e7', leadId: 'l8', from: 'marcus@integrateapi.ai', to: 'lbrennan@northstarfinance.com', subject: 'Compliance Review Follow-up', body: 'Hi Lisa,\n\nChecking in on the compliance review progress. Is there anything we can provide to help expedite things on your end?\n\nMarcus', sentAt: '2026-03-15T13:00:00Z', read: true, direction: 'outbound', threadId: 't6' },
  { id: 'e7b', leadId: 'l8', from: 'lbrennan@northstarfinance.com', to: 'marcus@integrateapi.ai', subject: 'Re: Compliance Review Follow-up', body: 'Marcus,\n\nOur legal team is about 70% through the review. They flagged a couple of data residency questions — specifically around where EU customer data is stored. Can you clarify?\n\nLisa', sentAt: '2026-03-16T10:15:00Z', read: true, direction: 'inbound', threadId: 't6', replyToId: 'e7' },
  { id: 'e7c', leadId: 'l8', from: 'marcus@integrateapi.ai', to: 'lbrennan@northstarfinance.com', subject: 'Re: Compliance Review Follow-up', body: 'Lisa,\n\nGood question. All EU data is stored in our Frankfurt (eu-central-1) region. We never transfer PII outside the region unless explicitly configured. I\'ll send over our data residency whitepaper.\n\nMarcus', sentAt: '2026-03-16T14:00:00Z', read: true, direction: 'outbound', threadId: 't6', replyToId: 'e7b' },

  // Thread 7: Maya Foster — Bulk API
  { id: 'e8', leadId: 'l14', from: 'mfoster@brightpath.edu', to: 'marcus@integrateapi.ai', subject: 'API Bulk Access Inquiry', body: 'Hi Marcus,\n\nWe\'re building a student records platform and need to handle about 50k records daily. Does your API support batch processing at that scale?\n\nMaya Foster\nBrightPath Education', sentAt: '2026-03-19T09:00:00Z', read: true, direction: 'inbound', threadId: 't7' },
  { id: 'e8b', leadId: 'l14', from: 'marcus@integrateapi.ai', to: 'mfoster@brightpath.edu', subject: 'Re: API Bulk Access Inquiry', body: 'Maya,\n\nAbsolutely — our batch endpoint handles up to 100k records per job. For education use cases, we also have FERPA-compliant data handling built in.\n\nWant me to set up a sandbox so your team can test it?\n\nMarcus', sentAt: '2026-03-19T14:00:00Z', read: true, direction: 'outbound', threadId: 't7', replyToId: 'e8' },
  { id: 'e8c', leadId: 'l14', from: 'mfoster@brightpath.edu', to: 'marcus@integrateapi.ai', subject: 'Re: API Bulk Access Inquiry', body: 'Marcus,\n\nThat would be great. We need to handle about 50k student records daily through the batch endpoint. Can you also send over the FERPA documentation?\n\nMaya', sentAt: '2026-03-20T11:00:00Z', read: true, direction: 'inbound', threadId: 't7', replyToId: 'e8b' },

  // Thread 8: Hannah Nguyen
  { id: 'e9', leadId: 'l10', from: 'marcus@integrateapi.ai', to: 'hnguyen@terraverde.io', subject: 'Welcome to IntegrateAPI — Next Steps', body: 'Hi Hannah,\n\nGreat chatting earlier! As discussed, here\'s what I\'d recommend for TerraVerde:\n\n1. Start with our API-first starter plan\n2. Connect your environmental sensors via our IoT bridge\n3. Use our dashboard for real-time data monitoring\n\nI\'ll send sandbox credentials by EOD.\n\nMarcus', sentAt: '2026-03-21T09:30:00Z', read: true, direction: 'outbound', threadId: 't8' },
  { id: 'e9b', leadId: 'l10', from: 'hnguyen@terraverde.io', to: 'marcus@integrateapi.ai', subject: 'Re: Welcome to IntegrateAPI — Next Steps', body: 'Marcus,\n\nThis sounds perfect. We\'re especially excited about the IoT bridge — we have 200+ sensors in the field that need real-time API access. Looking forward to the sandbox!\n\nHannah', sentAt: '2026-03-21T16:00:00Z', read: false, direction: 'inbound', threadId: 't8', replyToId: 'e9' },
];

export const mockDeals: Deal[] = [
  { id: 'd1', leadId: 'l1', title: 'Meridian Enterprise License', value: 48000, stage: 'proposal', assignedTo: 'u2', createdAt: '2026-03-01T09:00:00Z', updatedAt: '2026-03-18T14:30:00Z' },
  { id: 'd2', leadId: 'l4', title: 'Firestart Portfolio Partnership', value: 72000, stage: 'qualified', assignedTo: 'u2', createdAt: '2026-03-05T10:00:00Z', updatedAt: '2026-03-20T16:00:00Z' },
  { id: 'd3', leadId: 'l7', title: 'Orbital AI Custom Integration', value: 24000, stage: 'contacted', assignedTo: 'u3', createdAt: '2026-03-10T15:00:00Z', updatedAt: '2026-03-19T10:00:00Z' },
  { id: 'd4', leadId: 'l10', title: 'TerraVerde Startup Plan', value: 12000, stage: 'negotiation', assignedTo: 'u2', createdAt: '2026-03-12T14:00:00Z', updatedAt: '2026-03-21T09:00:00Z' },
  { id: 'd5', leadId: 'l15', title: 'IronForge Security Package', value: 36000, stage: 'contacted', assignedTo: 'u3', createdAt: '2026-03-18T13:00:00Z', updatedAt: '2026-03-22T09:00:00Z' },
  { id: 'd6', leadId: 'l18', title: 'LumenRx HIPAA Integration', value: 60000, stage: 'qualified', assignedTo: 'u2', createdAt: '2026-03-19T11:00:00Z', updatedAt: '2026-03-22T16:00:00Z' },
  { id: 'd7', leadId: 'l3', title: 'BlueLine Logistics Platform', value: 30000, stage: 'proposal', assignedTo: 'u3', createdAt: '2026-02-15T08:00:00Z', updatedAt: '2026-03-10T11:00:00Z' },
  { id: 'd8', leadId: 'l21', title: 'Wave Energy IoT Integration', value: 18000, stage: 'new', assignedTo: 'u3', createdAt: '2026-03-20T10:00:00Z', updatedAt: '2026-03-22T08:00:00Z' },
  { id: 'd9', leadId: 'l13', title: 'Summit Cloud Deal', value: 42000, stage: 'closed_lost', assignedTo: 'u3', createdAt: '2025-10-15T08:00:00Z', updatedAt: '2025-12-20T10:00:00Z' },
  { id: 'd10', leadId: 'l22', title: 'CivicWorks GovTech Contract', value: 55000, stage: 'new', assignedTo: 'u2', createdAt: '2026-03-21T08:00:00Z', updatedAt: '2026-03-22T12:00:00Z' },
];

export const mockSuggestions: AISuggestion[] = [
  { id: 's1', leadId: 'l1', suggestion: 'Board meeting is March 25th — schedule follow-up call for March 26th', priority: 'high', createdAt: '2026-03-22T08:00:00Z', dismissed: false },
  { id: 's2', leadId: 'l2', suggestion: 'No contact made yet — send introductory email this week', priority: 'medium', createdAt: '2026-03-22T08:00:00Z', dismissed: false },
  { id: 's3', leadId: 'l4', suggestion: 'Nadia mentioned 3 portfolio companies — prepare multi-tenant pricing', priority: 'high', createdAt: '2026-03-22T08:00:00Z', dismissed: false },
  { id: 's4', leadId: 'l8', suggestion: 'Compliance review taking long — offer to connect with our security team', priority: 'medium', createdAt: '2026-03-22T08:00:00Z', dismissed: false },
  { id: 's5', leadId: 'l11', suggestion: 'Carlos evaluating competitors — send comparison deck immediately', priority: 'high', createdAt: '2026-03-22T08:00:00Z', dismissed: false },
  { id: 's6', leadId: 'l10', suggestion: 'Hannah wants a trial — set up sandbox environment today', priority: 'high', createdAt: '2026-03-22T08:00:00Z', dismissed: false },
  { id: 's7', leadId: 'l17', suggestion: 'Connected vehicle use case — prepare IoT-specific case study', priority: 'low', createdAt: '2026-03-22T08:00:00Z', dismissed: false },
  { id: 's8', leadId: 'l5', suggestion: 'Marked dead due to budget — re-engage in Q3 (July)', priority: 'low', createdAt: '2026-03-22T08:00:00Z', dismissed: false },
];

export const mockSequences: EmailSequence[] = [
  {
    id: 'seq1',
    name: 'Cold Outreach — SaaS CTOs',
    steps: [
      { id: 'st1', order: 1, subject: 'API integration that saves your team 40 hours/month', body: 'Hi {{firstName}},\n\nI noticed {{company}} is scaling its platform...', delayDays: 0 },
      { id: 'st2', order: 2, subject: 'Quick follow-up — {{company}} + IntegrateAPI', body: 'Hi {{firstName}},\n\nJust wanted to circle back on my previous email...', delayDays: 3 },
      { id: 'st3', order: 3, subject: 'Last touch — would love 15 minutes', body: 'Hi {{firstName}},\n\nI know you\'re busy, so I\'ll keep this brief...', delayDays: 5 },
    ],
    createdBy: 'u2',
    active: true,
  },
  {
    id: 'seq2',
    name: 'Demo Follow-up Sequence',
    steps: [
      { id: 'st4', order: 1, subject: 'Great chatting — next steps for {{company}}', body: 'Hi {{firstName}},\n\nThanks for taking the time for a demo today...', delayDays: 0 },
      { id: 'st5', order: 2, subject: 'Any questions about the demo?', body: 'Hi {{firstName}},\n\nWanted to check if you had any questions after our demo...', delayDays: 2 },
    ],
    createdBy: 'u3',
    active: true,
  },
];

// Credentials for mocked login
export const mockCredentials = [
  { email: 'sarah@integrateapi.ai', password: 'admin123', userId: 'u1' },
  { email: 'marcus@integrateapi.ai', password: 'employee123', userId: 'u2' },
  { email: 'aisha@integrateapi.ai', password: 'employee123', userId: 'u3' },
];

export const mockCampaigns: Campaign[] = [
  {
    id: 'camp1',
    subject: 'Introducing IntegrateAPI — Save 40 hours/month on integrations',
    body: 'Hi {{firstName}},\n\nI wanted to reach out because {{company}} could benefit from our API-first platform.\n\nWe help teams like yours cut integration time by 60%. Would you be open to a quick 15-minute call this week?\n\nBest,\nSarah Chen\nIntegrateAPI',
    recipientIds: ['l2', 'l6', 'l9', 'l12', 'l16', 'l19'],
    sentAt: '2026-03-15T09:00:00Z',
    sentBy: 'u1',
  },
  {
    id: 'camp2',
    subject: 'Q1 Product Update — New Enterprise Features',
    body: 'Hi {{firstName}},\n\nExciting news from IntegrateAPI! We just shipped:\n\n• SOC2-compliant API gateway\n• Bulk data processing (50k records/min)\n• Custom webhook routing\n\nWould love to show you how these could help {{company}}.\n\nCheers,\nMarcus Rivera\nIntegrateAPI',
    recipientIds: ['l1', 'l4', 'l7', 'l10', 'l15', 'l18', 'l21'],
    sentAt: '2026-03-20T10:00:00Z',
    sentBy: 'u2',
  },
];
