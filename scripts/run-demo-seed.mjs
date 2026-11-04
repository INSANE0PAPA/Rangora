import postgres from 'postgres';

const demoUrl = process.env.DATABASE_URL_DEMO;
const expectedTimeline = process.env.EXPECTED_DEMO_TIMELINE_ID;

if (!demoUrl) {
  console.error('[ERROR] DATABASE_URL_DEMO not configured.');
  process.exit(1);
}

const sql = postgres(demoUrl, { max: 1, ssl: 'require' });

try {
  console.log('--- Phase 3: Demo Seed Pre-Flight Safety Check ---');
  const [tl] = await sql`SHOW neon.timeline_id`;
  const actualTimeline = tl ? tl['neon.timeline_id'] : null;

  if (actualTimeline === 'ff6dc35ad13680c0a665fbd20e4d4876') {
    throw new Error('CRITICAL SAFETY ABORT: Target is PRODUCTION timeline!');
  }
  if (expectedTimeline && actualTimeline !== expectedTimeline) {
    throw new Error(`CRITICAL SAFETY ABORT: Timeline mismatch! Expected ${expectedTimeline}, got ${actualTimeline}`);
  }
  console.log(`Timeline verified safe: ${actualTimeline}`);

  // Now run the seed logic
  console.log('Executing seedDemoDatabase()...');
  const startTime = Date.now();

  const ALL_DEMO_USER_IDS = [
    'd3300001-0000-4000-8000-000000000001',
    'd3300002-0000-4000-8000-000000000002',
    'd3300003-0000-4000-8000-000000000003',
    'd3300004-0000-4000-8000-000000000004',
    'd3300005-0000-4000-8000-000000000005',
    'd3300010-0000-4000-8000-000000000010',
    'd3300011-0000-4000-8000-000000000011',
    'd3300012-0000-4000-8000-000000000012',
    'd3300013-0000-4000-8000-000000000013',
    'd3300014-0000-4000-8000-000000000014',
  ];

  const DEMO_PARTICIPANT_ID = 'd3300001-0000-4000-8000-000000000001';
  const DEMO_ORGANISER_ID = 'd3300002-0000-4000-8000-000000000002';
  const DEMO_ADMIN_ID = 'd3300003-0000-4000-8000-000000000003';
  const DEMO_APPLICANT_AARAV = 'd3300004-0000-4000-8000-000000000004';
  const DEMO_APPLICANT_SNEHA = 'd3300005-0000-4000-8000-000000000005';
  const DEMO_USER_AANYA = 'd3300010-0000-4000-8000-000000000010';
  const DEMO_USER_DEV = 'd3300011-0000-4000-8000-000000000011';
  const DEMO_USER_PRIYA = 'd3300012-0000-4000-8000-000000000012';
  const DEMO_USER_ROHAN = 'd3300013-0000-4000-8000-000000000013';
  const DEMO_USER_ARJUN = 'd3300014-0000-4000-8000-000000000014';

  await sql.begin(async (tx) => {
    // 1. Clean up demo-specific rows in strict foreign-key dependency order
    // a. Remove any runtime events created by demo organiser (keeping catalog events 1..38 and 43)
    await tx`DELETE FROM public.events WHERE organiser_id = ANY(${ALL_DEMO_USER_IDS}::uuid[]) AND id NOT IN (4, 27, 43)`;
    
    // b. Detach catalog events organiser_id temporarily so profiles can be reseeded
    await tx`UPDATE public.events SET organiser_id = NULL WHERE organiser_id = ANY(${ALL_DEMO_USER_IDS}::uuid[])`;

    // c. Attendance (references registrations and profiles)
    await tx`DELETE FROM public.attendance WHERE user_id = ANY(${ALL_DEMO_USER_IDS}::uuid[]) OR verified_by = ANY(${ALL_DEMO_USER_IDS}::uuid[])`;

    // d. Registrations (references profiles)
    await tx`DELETE FROM public.registrations WHERE user_id = ANY(${ALL_DEMO_USER_IDS}::uuid[])`;

    // e. Review likes and reviews (review_likes references reviews and profiles)
    await tx`DELETE FROM public.review_likes WHERE user_id = ANY(${ALL_DEMO_USER_IDS}::uuid[]) OR review_id IN (SELECT id FROM public.reviews WHERE user_id = ANY(${ALL_DEMO_USER_IDS}::uuid[]))`;
    await tx`DELETE FROM public.reviews WHERE user_id = ANY(${ALL_DEMO_USER_IDS}::uuid[])`;

    // f. User achievements, vouchers, badges, rewards
    await tx`DELETE FROM public.user_achievements WHERE user_id = ANY(${ALL_DEMO_USER_IDS}::uuid[])`;
    await tx`DELETE FROM public.user_vouchers WHERE user_id = ANY(${ALL_DEMO_USER_IDS}::uuid[])`;
    await tx`DELETE FROM public.user_event_badges WHERE user_id = ANY(${ALL_DEMO_USER_IDS}::uuid[])`;
    await tx`DELETE FROM public.reward_awards WHERE user_id = ANY(${ALL_DEMO_USER_IDS}::uuid[]) OR awarded_by = ANY(${ALL_DEMO_USER_IDS}::uuid[])`;

    // g. Help requests
    await tx`DELETE FROM public.help_requests WHERE user_id = ANY(${ALL_DEMO_USER_IDS}::uuid[]) OR routed_to = ANY(${ALL_DEMO_USER_IDS}::uuid[]) OR id IN ('d3300501-0000-4000-8000-000000000501'::uuid, 'd3300502-0000-4000-8000-000000000502'::uuid)`;

    // h. Sponsors
    await tx`DELETE FROM public.sponsors WHERE user_id = ANY(${ALL_DEMO_USER_IDS}::uuid[]) OR requested_by = ANY(${ALL_DEMO_USER_IDS}::uuid[]) OR id IN ('d3300401-0000-4000-8000-000000000401'::uuid, 'd3300402-0000-4000-8000-000000000402'::uuid)`;

    // i. Leaderboard (user_id references profiles)
    await tx`DELETE FROM public.leaderboard WHERE user_id = ANY(${ALL_DEMO_USER_IDS}::uuid[])`;

    // j. Role and specific profiles
    await tx`DELETE FROM public.organiser_profiles WHERE user_id = ANY(${ALL_DEMO_USER_IDS}::uuid[])`;
    await tx`DELETE FROM public.admin_profiles WHERE user_id = ANY(${ALL_DEMO_USER_IDS}::uuid[])`;
    await tx`DELETE FROM public.user_roles WHERE user_id = ANY(${ALL_DEMO_USER_IDS}::uuid[])`;

    // k. Profiles
    await tx`DELETE FROM public.profiles WHERE id = ANY(${ALL_DEMO_USER_IDS}::uuid[])`;

    // 2. Profiles
    const demoProfiles = [
      { id: DEMO_PARTICIPANT_ID, fullName: "Maya Sen", email: "maya.sen@campus.rangora.in", phone: "+91 98301 23456", address: "Salt Lake Campus Hostel 3, Room 204", department: "Visual Arts · Year 2", course: "B.Des Interaction Design", preferences: ["workshops", "cultural", "music"] },
      { id: DEMO_ORGANISER_ID, fullName: "Ritwik Das", email: "ritwik.arts@campus.rangora.in", phone: "+91 98312 87654", address: "Faculty of Fine Arts, Studio 4B", department: "Fine Arts & Design", course: "M.F.A. Printmaking", preferences: ["workshops", "cultural"] },
      { id: DEMO_ADMIN_ID, fullName: "Rangora Administrator", email: "admin@campus.rangora.in", phone: "+91 98300 00000", address: "Student Affairs Secretariat, Administrative Block", department: "Student Affairs", course: "Administration", preferences: [] },
      { id: DEMO_APPLICANT_AARAV, fullName: "Aarav Mehta", email: "aarav.robo@campus.rangora.in", phone: null, address: null, department: "Robotics & AI Lab", course: "B.Tech Mechatronics", preferences: ["technical"] },
      { id: DEMO_APPLICANT_SNEHA, fullName: "Sneha Sen", email: "sneha.film@campus.rangora.in", phone: null, address: null, department: "Film Studies", course: "M.A. Cinema", preferences: ["community"] },
      { id: DEMO_USER_AANYA, fullName: "Aanya Sen", email: "aanya.cs@campus.rangora.in", phone: null, address: null, department: "Computer Science", course: "B.Tech CSE", preferences: ["music", "technical"] },
      { id: DEMO_USER_DEV, fullName: "Dev Patel", email: "dev.ee@campus.rangora.in", phone: null, address: null, department: "Electronics Eng.", course: "B.Tech ECE", preferences: ["technical", "gaming"] },
      { id: DEMO_USER_PRIYA, fullName: "Priya Roy", email: "priya.arch@campus.rangora.in", phone: null, address: null, department: "Architecture", course: "B.Arch", preferences: ["cultural", "workshops"] },
      { id: DEMO_USER_ROHAN, fullName: "Rohan Mukherjee", email: "rohan.bio@campus.rangora.in", phone: null, address: null, department: "Biotechnology", course: "M.Sc Biotech", preferences: ["community"] },
      { id: DEMO_USER_ARJUN, fullName: "Arjun Sen", email: "arjun.fa@campus.rangora.in", phone: null, address: null, department: "Fine Arts", course: "B.F.A. Painting", preferences: ["cultural"] },
    ];

    for (const p of demoProfiles) {
      await tx`
        INSERT INTO public.profiles (id, full_name, email, phone, address, department, course, preferences)
        VALUES (${p.id}, ${p.fullName}, ${p.email}, ${p.phone}, ${p.address}, ${p.department}, ${p.course}, ${p.preferences})
      `;
    }

    // 3. User Roles
    const roles = [
      { userId: DEMO_PARTICIPANT_ID, role: "participant" },
      { userId: DEMO_ORGANISER_ID, role: "organizer" },
      { userId: DEMO_ADMIN_ID, role: "admin" },
      { userId: DEMO_APPLICANT_AARAV, role: "participant" },
      { userId: DEMO_APPLICANT_SNEHA, role: "organizer" },
      { userId: DEMO_USER_AANYA, role: "participant" },
      { userId: DEMO_USER_DEV, role: "participant" },
      { userId: DEMO_USER_PRIYA, role: "participant" },
      { userId: DEMO_USER_ROHAN, role: "participant" },
      { userId: DEMO_USER_ARJUN, role: "participant" },
    ];

    for (const r of roles) {
      await tx`
        INSERT INTO public.user_roles (user_id, role)
        VALUES (${r.userId}, ${r.role}::public.app_role)
      `;
    }

    // 4. Organiser Profiles
    await tx`
      INSERT INTO public.organiser_profiles (user_id, org_name, position, org_type, institutional_id, description, status)
      VALUES 
        (${DEMO_ORGANISER_ID}, 'Campus Arts Guild', 'Convenor & Studio Lead', 'Fine Arts Club', 'INST-ART-2024-09', 'Host wheel pottery, printmaking labs, and architectural courtyard sketches across festivals.', 'approved'),
        (${DEMO_APPLICANT_AARAV}, 'Robotics & Hardware Society', 'Technical Director', 'Engineering Society', 'ROBO-2026-88', 'Run 24-hr hardware sprints, autonomous micro-rover arena exhibitions, and cyber defense CTF challenges.', 'pending'),
        (${DEMO_APPLICANT_SNEHA}, 'Campus Cinema Collective', 'Curator', 'Media & Film Guild', 'FILM-2025-04', 'Outdoor 16mm student short films and director conversation circles under the stars.', 'approved')
    `;

    // 5. Admin Profiles
    await tx`
      INSERT INTO public.admin_profiles (user_id, office, designation, staff_id, status)
      VALUES (${DEMO_ADMIN_ID}, 'Student Affairs Secretariat', 'Campus Festival Administrator', 'ADMIN-SEC-001', 'approved')
    `;

    // 6. Ensure Organiser Events are marked with organiser_id
    await tx`
      UPDATE public.events 
      SET organiser_id = ${DEMO_ORGANISER_ID} 
      WHERE id IN (4, 27, 43);
    `;

    // 7. Initial Registrations
    const regs = [
      { id: "d3300101-0000-4000-8000-000000000101", userId: DEMO_PARTICIPANT_ID, eventId: 4, kind: "booked", passCode: "RNG-DEMO-1042" },
      { id: "d3300102-0000-4000-8000-000000000102", userId: DEMO_PARTICIPANT_ID, eventId: 1, kind: "booked", passCode: "RNG-DEMO-1043" },
      { id: "d3300103-0000-4000-8000-000000000103", userId: DEMO_PARTICIPANT_ID, eventId: 2, kind: "planned", passCode: "RNG-PLAN-002" },
      { id: "d3300110-0000-4000-8000-000000000110", userId: DEMO_USER_AANYA, eventId: 1, kind: "booked", passCode: "RNG-DEMO-1050" },
      { id: "d3300111-0000-4000-8000-000000000111", userId: DEMO_USER_DEV, eventId: 13, kind: "booked", passCode: "RNG-DEMO-1051" },
      { id: "d3300112-0000-4000-8000-000000000112", userId: DEMO_USER_PRIYA, eventId: 2, kind: "booked", passCode: "RNG-DEMO-1052" },
      { id: "d3300113-0000-4000-8000-000000000113", userId: DEMO_USER_ROHAN, eventId: 3, kind: "booked", passCode: "RNG-DEMO-1053" },
      { id: "d3300114-0000-4000-8000-000000000114", userId: DEMO_USER_ARJUN, eventId: 16, kind: "booked", passCode: "RNG-DEMO-1054" },
    ];

    for (const r of regs) {
      await tx`
        INSERT INTO public.registrations (id, user_id, event_id, kind, pass_code)
        VALUES (${r.id}, ${r.userId}, ${r.eventId}, ${r.kind}, ${r.passCode})
      `;
    }

    // 8. Attendance
    const attendances = [
      { id: "d3300151-0000-4000-8000-000000000151", regId: "d3300101-0000-4000-8000-000000000101", userId: DEMO_PARTICIPANT_ID, eventId: 4 },
      { id: "d3300152-0000-4000-8000-000000000152", regId: "d3300110-0000-4000-8000-000000000110", userId: DEMO_USER_AANYA, eventId: 1 },
      { id: "d3300153-0000-4000-8000-000000000153", regId: "d3300111-0000-4000-8000-000000000111", userId: DEMO_USER_DEV, eventId: 13 },
      { id: "d3300154-0000-4000-8000-000000000154", regId: "d3300112-0000-4000-8000-000000000112", userId: DEMO_USER_PRIYA, eventId: 2 },
      { id: "d3300155-0000-4000-8000-000000000155", regId: "d3300113-0000-4000-8000-000000000113", userId: DEMO_USER_ROHAN, eventId: 3 },
      { id: "d3300156-0000-4000-8000-000000000156", regId: "d3300114-0000-4000-8000-000000000114", userId: DEMO_USER_ARJUN, eventId: 16 },
    ];

    for (const a of attendances) {
      await tx`
        INSERT INTO public.attendance (id, registration_id, user_id, event_id, verified_by)
        VALUES (${a.id}, ${a.regId}, ${a.userId}, ${a.eventId}, ${DEMO_ORGANISER_ID})
      `;
    }

    // 9. User Achievements
    await tx`
      INSERT INTO public.user_achievements (user_id, code)
      VALUES
        (${DEMO_PARTICIPANT_ID}, 'first_experience'),
        (${DEMO_PARTICIPANT_ID}, 'guild_artisan'),
        (${DEMO_PARTICIPANT_ID}, 'verified_debut')
    `;

    // 10. User Vouchers
    await tx`
      INSERT INTO public.user_vouchers (id, user_id, campaign_id, code)
      VALUES
        ('d3300301-0000-4000-8000-000000000301', ${DEMO_PARTICIPANT_ID}, 1, 'RNG-DEMO-50PCT'),
        ('d3300302-0000-4000-8000-000000000302', ${DEMO_PARTICIPANT_ID}, 2, 'RNG-DEMO-MAKER')
    `;

    // 11. Event Echoes
    const echoes = [
      { id: "d3300201-0000-4000-8000-000000000201", eventId: 4, userId: DEMO_PARTICIPANT_ID, authorName: "Maya Sen", rating: 5, comment: "Loved centering local river clay on the wheel. Taking home a handmade terracotta vessel was magical! Studio masters were patient and inspiring.", media: JSON.stringify([{ path: "/assets/echoes/pottery_wheel.svg", name: "pottery_wheel.svg", type: "image/svg+xml" }]), taggedFriends: ["Arjun Sen", "Pooja Das"], likedByOrganiser: true, visibility: "public", moderationStatus: "approved" },
      { id: "d3300202-0000-4000-8000-000000000202", eventId: 1, userId: DEMO_USER_AANYA, authorName: "Aanya Sen", rating: 5, comment: "The acoustic sitar in the dusk courtyard gave everyone goosebumps! Unforgettable open-air evening with hot spiced chai under festive lights.", media: JSON.stringify([{ path: "/assets/echoes/raga_concert.svg", name: "raga_concert.svg", type: "image/svg+xml" }]), taggedFriends: ["Priya Roy", "Kabir Roy"], likedByOrganiser: true, visibility: "public", moderationStatus: "approved" },
      { id: "d3300203-0000-4000-8000-000000000203", eventId: 13, userId: DEMO_USER_DEV, authorName: "Dev Patel", rating: 5, comment: "Testing our pathfinding algorithm on the mock lunar gravel arena was intense. The calibrated LiDAR and depth sensors worked flawlessly!", media: JSON.stringify([{ path: "/assets/echoes/robotics_sprint.svg", name: "robotics_sprint.svg", type: "image/svg+xml" }]), taggedFriends: ["Rohan Mukherjee"], likedByOrganiser: true, visibility: "public", moderationStatus: "approved" },
      { id: "d3300204-0000-4000-8000-000000000204", eventId: 2, userId: DEMO_USER_PRIYA, authorName: "Priya Roy", rating: 4, comment: "Mesmerizing fusion of Kathak mudras with contemporary floor work and live tabla accompaniment. Pure visual poetry in the conservatory.", media: JSON.stringify([{ path: "/assets/echoes/dance_kathak.svg", name: "dance_kathak.svg", type: "image/svg+xml" }]), taggedFriends: ["Maya Sen", "Sunita Rao"], likedByOrganiser: false, visibility: "public", moderationStatus: "approved" },
      { id: "d3300205-0000-4000-8000-000000000205", eventId: 3, userId: DEMO_USER_ROHAN, authorName: "Rohan Mukherjee", rating: 5, comment: "Sipping clay kulhad chai on the observatory lawn while watching student 16mm shorts under the open sky was peak autumn campus nostalgia.", media: JSON.stringify([{ path: "/assets/echoes/cinema_circle.svg", name: "cinema_circle.svg", type: "image/svg+xml" }]), taggedFriends: ["Aanya Sen", "Arjun Sen"], likedByOrganiser: true, visibility: "public", moderationStatus: "approved" },
      { id: "d3300206-0000-4000-8000-000000000206", eventId: 16, userId: DEMO_USER_ARJUN, authorName: "Arjun Sen", rating: 5, comment: "The acrobatic Purulia Chhau leaps and live dhamsa drums reverberated right through the banyan tree roots! Spectacular energy.", media: JSON.stringify([{ path: "/assets/echoes/dance_kathak.svg", name: "dance_kathak.svg", type: "image/svg+xml" }]), taggedFriends: ["Maya Sen"], likedByOrganiser: false, visibility: "public", moderationStatus: "approved" },
    ];

    for (const e of echoes) {
      await tx`
        INSERT INTO public.reviews (id, event_id, user_id, author_name, rating, comment, media, tagged_friends, liked_by_organiser, visibility, moderation_status)
        VALUES (${e.id}, ${e.eventId}, ${e.userId}, ${e.authorName}, ${e.rating}, ${e.comment}, ${e.media}::jsonb, ${e.taggedFriends}, ${e.likedByOrganiser}, ${e.visibility}, ${e.moderationStatus})
      `;
    }

    // 12. Sponsors
    await tx`
      INSERT INTO public.sponsors (id, user_id, name, tier, amount, contact, message, requested_by, status)
      VALUES
        ('d3300401-0000-4000-8000-000000000401', ${DEMO_ORGANISER_ID}, 'Northstar Campus Café', 'Gold', 45000, 'partnerships@northstarcafe.in', 'Providing complimentary cold brew & spiced chai stations for courtyard workshops.', ${DEMO_ORGANISER_ID}, 'requested'),
        ('d3300402-0000-4000-8000-000000000402', NULL, 'Bengal Heritage Crafts Trust', 'Gold', 75000, 'trust@bengalcrafts.org', 'Endowing terracotta wheel masterclasses and natural dye supplies.', NULL, 'active')
    `;

    // 13. Help Requests
    await tx`
      INSERT INTO public.help_requests (id, user_id, author_name, event_id, category, subject, message, status, routed_to)
      VALUES
        ('d3300501-0000-4000-8000-000000000501', ${DEMO_PARTICIPANT_ID}, 'Maya Sen', 4, 'event', 'Pottery studio clay trimming tools', 'Are trimming loops and aprons provided at the studio, or should participants bring their own?', 'open', ${DEMO_ORGANISER_ID}),
        ('d3300502-0000-4000-8000-000000000502', ${DEMO_USER_PRIYA}, 'Priya Roy', NULL, 'voucher', 'Voucher validity extension', 'Can I use the Autumn 50% pass voucher for next week''s Yantra & Verse Hackathon?', 'open', NULL)
    `;

    // 14. Leaderboard
    const leaders = [
      { userId: DEMO_USER_AANYA, displayName: "Aanya Sen", department: "Computer Science", points: 190 },
      { userId: DEMO_USER_DEV, displayName: "Dev Patel", department: "Electronics Eng.", points: 150 },
      { userId: DEMO_USER_PRIYA, displayName: "Priya Roy", department: "Architecture", points: 130 },
      { userId: DEMO_PARTICIPANT_ID, displayName: "Maya Sen", department: "Visual Arts · Year 2", points: 110 },
      { userId: DEMO_USER_ROHAN, displayName: "Rohan Mukherjee", department: "Biotechnology", points: 80 },
    ];

    for (const l of leaders) {
      await tx`
        INSERT INTO public.leaderboard (user_id, display_name, department, points)
        VALUES (${l.userId}, ${l.displayName}, ${l.department}, ${l.points})
      `;
    }
  });

  const duration = Date.now() - startTime;
  console.log(`[SUCCESS] seedDemoDatabase() executed in ${duration}ms within single transaction.`);
} catch (e) {
  console.error('[ABORT]', e.message);
  process.exit(1);
} finally {
  await sql.end({ timeout: 5 });
}
