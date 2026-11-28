/* York Cottage Spa: starting settings, taken from the live yorkcottagespa.com pages (November 2026).
   Everything here can be changed in the admin portal. Shared by the admin and the public site. */
(function (root) {
  const wk = (o, c) => ({ start: o, end: c });
  const D = {
    v: 1,
    business: {
      name: 'York Cottage Spa', phone: '01933 580 100', email: 'info@yorkcottagespa.com', whatsapp: '',
      address: 'Easton Lane, Bozeat, Northamptonshire NN29 7NN', website: 'https://www.yorkcottagespa.com',
      googleReviewUrl: '', vatNumber: '', currency: 'GBP'
    },
    rules: {
      bookAheadDays: 365,        // how far ahead people can book online
      minNoticeHours: 24,        // online bookings need this much notice
      slotStep: 30,              // treatments start every N minutes, on the clock: 15, 30 (on the hour and half hour) or 60 (on the hour)
      minHandover: 15,           // every treatment leaves at least this long before the next one (room reset + therapist)
      maxHandsOn: 360,           // default therapist hands-on minutes per day (4-6 hours is good practice)
      // Breaks (each person can have their own in Staff). UK law: a 20-minute break for days over 6 hours.
      breaks: {
        lunchMin: 30, lunchMax: 60,            // lunch length, minutes
        lunchFrom: '11:30', lunchTo: '15:00',  // lunch has to happen in this window
        lunchIfOver: 360,                      // days longer than this (minutes) need a lunch
        breakMin: 15, breakMax: 30,            // other breaks, minutes (a free gap this long counts as a break)
        maxWithoutBreak: 240                   // longest stretch of work without a break, minutes
      },
      headSpaOff: 10,            // % off Japanese head spa with a spa session or stay
      blueLight: true,           // Blue Light Card: included treatments upgraded to 30 minutes
      blueLightMin: 30,
      share: 'fill',             // 'fill' = use therapist 1 (by priority) where possible, then the next; 'even' = share evenly
      groupTogether: true,       // groups: try to give guests their treatments at the same time, with different therapists
      groupTogetherFrom: 2,      // ...for bookings of this many guests or more (each product can override with together: true/false)
      holdMinutes: 30,           // online checkout holds a slot this long (needs the live payment server)
      // "Just for us" (exclusive use for fewer than 6): a charge per empty place (user 2026-11-28), last-minute discount on
      exclHalf: 25, exclFull: 40, exclNight: 75, exclLast: true, exclLastDays: 7, exclLastPct: 50,
      groupOn: true, groupFrom: 6, groupPct: 10   // group discount: % off the booking price for this many guests or more (user 2026-11-28)
    },
    // Spa opening hours by weekday (0 = Sunday). null = closed.
    hours: { 0: wk('09:30', '22:30'), 1: wk('09:30', '22:00'), 2: wk('09:30', '22:00'), 3: wk('09:30', '22:00'), 4: wk('09:30', '22:00'), 5: wk('09:30', '22:00'), 6: wk('09:30', '22:00') },
    hoursOverride: {},
    // Treatments start no earlier than 'first' and no later than 'last' (guests arrive 09:30, first treatment 10:00).
    // Override per weekday (0 = Sunday) or for a date in dates: { '2026-12-24': { last:'14:00' } }.
    treatTimes: { default: { first: '10:00', last: '21:00' }, dates: {} },           // { '2026-12-24': { start:'09:30', end:'15:00' } }
    // Closures: whole place, the spa, rooms, treatments, one product or one room. Dates inclusive.
    closures: [
      { id: 'xmas26', from: '2026-12-25', to: '2026-12-26', scope: ['all'], reason: 'Christmas' }
    ],
    // Shared spa: at most this many people at once across normal bookings (Day Spa, Spa Access, spa breaks).
    // Exclusive bookings (Private Spa, Group Spa Break, Whole House, breaks of 6+) can go above it, but only when
    // nobody else is booked in the spa at that time, and nothing can be booked alongside them.
    spa: { capacity: 6, changeover: 30 },  // changeover: minutes of overlap allowed as one session leaves and the next arrives
    sessions: [
      {"id":"day-am","product":"day","name":"Morning","start":"09:30","end":"13:30","arrive":"09:15","cap":6,"days":[1,2,3,4,5,6,0],"active":true,"length":"half"},
      {"id":"day-pm","product":"day","name":"Afternoon","start":"13:00","end":"17:00","arrive":"12:45","cap":6,"days":[1,2,3,4,5,6,0],"active":true,"length":"half"},
      {"id":"day-full","product":"day","name":"Full day","start":"09:30","end":"17:00","arrive":"09:15","length":"full","price":135,"cap":6,"days":[1,2,3,4,5,6,0],"active":true},
      {"id":"acc-am","product":"access","name":"Morning","start":"09:30","end":"13:30","arrive":"09:15","cap":6,"days":[1,2,3,4,5,6,0],"active":true,"length":"half"},
      {"id":"acc-aft","product":"access","name":"Afternoon","start":"13:00","end":"17:00","arrive":"12:45","length":"half","cap":6,"days":[1,2,3,4,5,6,0],"active":true},
      {"id":"acc-full","product":"access","name":"Full day","start":"09:30","end":"17:00","arrive":"09:15","length":"full","price":75,"cap":6,"days":[1,2,3,4,5,6,0],"active":true},
      {"id":"acc-pm","product":"access","name":"Afternoon","start":"14:00","end":"18:00","arrive":"13:45","cap":6,"days":[1,2,3,4,5,6,0],"active":false},
      {"id":"acc-ev","product":"access","name":"Evening","start":"18:30","end":"22:00","arrive":"18:15","cap":6,"days":[5,6],"active":false},
      {"id":"prv-am","product":"private","name":"Morning","start":"09:30","end":"13:30","arrive":"09:15","cap":16,"days":[1,2,3,4,5,6],"active":true},
      {"id":"prv-pm","product":"private","name":"Afternoon","start":"14:00","end":"18:00","arrive":"13:45","cap":16,"days":[1,2,3,4,5,6],"active":true},
      {"id":"prv-sun","product":"private","name":"Sunday","start":"11:30","end":"15:30","arrive":"11:15","cap":16,"days":[0],"active":true}
    ],
    // booking types (user 2026-11-28); private, break2 and group are kept for older bookings, not sold
    products: {
      day: {"name":"Spa, Lunch & Treatment","kind":"session","price":100,"min":1,"max":6,"food":true,"benefits":["Spa pool, sauna & relaxation lounge","Lunch: afternoon tea or grazing board","20-minute massage or facial each","Towel, robe & slippers"],"includedPick":"one","active":true,"online":true,"blurb":"Everything in Spa Access Only, plus lunch (afternoon tea or a grazing board) and a 20-minute massage or facial each.","policy":"Spa days are paid in full and are non-refundable. You can move your visit (subject to availability) by emailing us at least 30 days before.","pay":{"deposit":100},"cancel":{"moveDays":30,"rules":[{"minDays":0,"keepPct":100}]},"exclusiveFrom":6,"exclusiveOption":true,"exclusiveCharge":6,"groupDiscount":true},
      access: {"name":"Spa Access Only","kind":"session","price":50,"min":1,"max":6,"food":false,"benefits":["Spa pool, sauna & relaxation lounge","Hot & cold drinks","Towel & robe"],"includedPick":"one","active":true,"online":true,"blurb":"Just the spa: pool, sauna and relaxation lounge, with hot & cold drinks, towel and robe. No food or treatment.","policy":"Spa days are paid in full and are non-refundable. You can move your visit (subject to availability) by emailing us at least 30 days before.","pay":{"deposit":100},"cancel":{"moveDays":30,"rules":[{"minDays":0,"keepPct":100}]},"exclusiveFrom":6,"exclusiveOption":true,"exclusiveCharge":6,"groupDiscount":true},
      private: {"name":"Private Spa","kind":"private","price":100,"min":4,"minByDay":{"0":6},"max":16,"food":true,"benefits":["The spa just for your group","Food & drinks","Towel & robe"],"includedPick":"one","active":false,"online":false,"blurb":"The spa just for your group, with food, drinks and a 20-minute massage or luxury facial each.","policy":"Spa days are paid in full and are non-refundable. You can move your visit (subject to availability) by emailing us at least 30 days before.","pay":{"deposit":100},"cancel":{"moveDays":30,"rules":[{"minDays":0,"keepPct":100}]}},
      break: {"name":"Spa Break","kind":"stay","priceN":{"1":150,"2":250,"3":350,"4":450,"5":550},"perPerson":true,"min":1,"max":16,"nights":[1,2,3,4,5],"arriveDays":{"1":[0,1,2,3,4],"2":[0,1,2,3],"3":[0,1,2],"4":[0,1],"5":[0]},"food":false,"foodsIncluded":["lunch"],"breakfast":true,"exclusiveFrom":6,"benefits":["A bedroom for every 2 guests","The spa from 2pm on arrival to 6pm on your last day","Lunch every day","Use of the kitchen for your dinner","20-minute massage or facial each"],"includedPick":"one","active":true,"online":true,"blurb":"Sunday to Thursday nights, 1 to 5 nights, 1 to 16 guests. The spa from 2pm on the day you arrive until 6pm on your last evening (Sunday arrivals 6pm–10:30pm), lunch every day, the kitchen for your dinner and a 20-minute massage or facial each.","times":{"0":{"checkIn":"14:00","spa":["18:00","22:30"],"food":"18:00","checkOut":"11:00"},"default":{"checkIn":"13:00","spa":["14:00","18:00"],"spaMid":["09:30","18:00"],"food":"13:00","checkOut":"11:00"}},"policy":"Spa breaks can be refunded if you cancel at least 30 days before arrival. With less notice the full cost is charged, and there are no refunds for leaving early.","pay":{"deposit":100},"cancel":{"rules":[{"minDays":30,"keepPct":0},{"minDays":0,"keepPct":100}]},"lunchDaily":true,"anyRoom":true,"singleSupp":50,"exclusiveOption":true,"exclusiveCharge":6,"dayHours":{"0":{"on":true,"from":"17:30","to":"22:00"}},"groupDiscount":true},
      break2: {"name":"2-Night Spa Break","kind":"stay","priceN":{"2":220},"perPerson":true,"min":2,"max":6,"nights":[2],"arriveDays":{"2":[0,1,2,3]},"food":false,"foodsIncluded":["grazing"],"breakfast":true,"exclusiveFrom":6,"benefits":["King ensuite room","Spa access","Sweet & savoury grazing board","Towel & robe"],"includedPick":"one","active":false,"online":false,"blurb":"Two nights from £220 per person, based on 2 sharing. King ensuite room, grazing board, 20-minute aromatherapy massage each, spa access.","times":{"0":{"checkIn":"14:00","spa":["18:00","22:30"],"spa2":["17:30","22:00"],"food":"16:30","checkOut":"11:00"},"default":{"checkIn":"13:30","spa":["14:00","18:00"],"food":"18:00","checkOut":"11:00"}},"policy":"Spa breaks can be refunded if you cancel at least 30 days before arrival. With less notice the full cost is charged, and there are no refunds for leaving early.","pay":{"deposit":100},"cancel":{"rules":[{"minDays":30,"keepPct":0},{"minDays":0,"keepPct":100}]}},
      group: {"name":"Group Spa Break","kind":"stay","priceN":{"1":145},"perPerson":true,"min":7,"max":16,"nights":[1],"arriveDays":{"1":[0,1,2,3,4]},"food":true,"foods":["grazing","tea"],"breakfast":true,"exclusive":true,"allRooms":true,"benefits":["The spa just for your group","Grazing board or afternoon tea","Up to 8 rooms"],"includedPick":"one","active":false,"online":false,"blurb":"7+ guests, Sunday to Thursday. Up to 8 rooms, the spa just for your group, a grazing board or afternoon tea and a 20-minute aromatherapy massage each.","times":{"0":{"checkIn":"15:30","spa":["17:30","22:00"],"food":"16:30","checkOut":"11:00"},"default":{"checkIn":"13:30","spa":["14:00","22:00"],"checkOut":"11:00"}},"policy":"Spa breaks can be refunded if you cancel at least 30 days before arrival. With less notice the full cost is charged, and there are no refunds for leaving early.","pay":{"deposit":100},"cancel":{"rules":[{"minDays":30,"keepPct":0},{"minDays":0,"keepPct":100}]}},
      house: {"name":"Whole House & Spa","kind":"house","night":1840,"minN":2,"maxN":30,"min":1,"max":16,"food":false,"benefits":["Exclusive use of the house & spa","Hot tub & sauna","Full kitchen & 2 living rooms","A basket of firewood"],"includedPick":"one","active":true,"online":true,"blurb":"The whole house and spa just for your group, up to 16 guests: 8 bedrooms, kitchen, 2 living rooms, hot tub and sauna. Friday and Saturday nights, and you can add nights either side.","times":{"default":{"checkIn":"16:00","spa":["08:00","22:00"],"checkOut":"11:00","spaLastDay":"10:30"}},"policy":"50% is paid now and the balance 6 weeks before arrival (bookings within 6 weeks are paid in full). Cancel 6+ months ahead and you can move your dates; 6+ weeks ahead, the deposit is kept; under 6 weeks, the full cost is kept. A £500 damage deposit is pre-authorised on your card and released within 48 hours of departure.","pay":{"deposit":50,"balanceDays":42,"damage":500},"cancel":{"moveDays":183,"rules":[{"minDays":42,"keepDeposit":true},{"minDays":0,"keepPct":100}]},"mustInclude":[5,6]},
      treat: {"name":"Treatments only","kind":"treat","price":0,"min":1,"max":4,"food":false,"benefits":[],"includedPick":"one","active":true,"online":true,"blurb":"Just here for a massage, facial or head spa? Choose your treatments with no spa session.","parts":{"Morning":["09:30","13:00"],"Afternoon":["13:00","18:00"]},"policy":"Spa days are paid in full and are non-refundable. You can move your visit (subject to availability) by emailing us at least 30 days before.","pay":{"deposit":100},"cancel":{"moveDays":30,"rules":[{"minDays":0,"keepPct":100}]}}
    },
    breakfastPrice: 10,
    // Food service: someone must be free to serve it (at least 1 person), so they can't be booked for treatments then.
    services: [
      {"id":"lunch","name":"Spa lunch service","start":"13:00","end":"14:00","products":["day","private","break"],"staff":1,"active":true,"byDay":{}},
      {"id":"grazing","name":"Grazing board service","start":"18:00","end":"18:30","products":["break","break2","group"],"staff":1,"active":true,"byDay":{"0":{"start":"18:00","end":"18:30"}}}
    ],
    serviceAssign: {},
    roles: null,                 // set in Settings → Roles (null = the standard roles)
    // Consultation form: questions (null = the standard set), online receiving address, how long to keep forms, public key
    consult: { questions: null, endpoint: '', retentionMonths: 24, publicKey: null },           // pinned people: { '2026-12-01': { lunch: ['s2'] } }
    foods: [
      {"id":"tea","name":"Afternoon tea","desc":"Sweet & savoury treats","products":["day","private","group"],"vegan":true,"active":true},
      {"id":"grazing","name":"Sweet & savoury grazing board","desc":"Meats, cheese & sweet treats · vegan available","products":["day","private","group","break","break2"],"vegan":true,"active":true},
      {"id":"lunch","name":"Lunch","desc":"Lunch in the house each day of a spa break","products":["break"],"active":true}
    ],
    treatments: [
      { id: 'inc-massage', cat: 'Massage', name: '20-Minute Aromatherapy Massage', min: 20, buffer: 10, price: 0, sell: false, includedWith: ['day', 'private', 'break', 'break2', 'group'], active: true, desc: 'A relaxing back, neck and shoulder massage with aromatherapy oils.' },
      { id: 'inc-facial', cat: 'Facials', name: '20-Minute Aromatherapy Facial', min: 20, buffer: 10, price: 0, sell: false, includedWith: ['day', 'break', 'break2', 'group'], active: true, desc: 'A short aromatherapy facial.' },
      { id: 'inc-lux-facial', cat: 'Facials', name: '20-Minute Luxury Facial', min: 20, buffer: 10, price: 0, sell: false, includedWith: ['private'], active: true, desc: 'A short luxury facial.' },
      { id: 'basics', cat: 'Facials', name: 'Back to Basics Facial', min: 30, buffer: 15, price: 50, active: true, desc: 'Aromatherapy facial with double cleanse, exfoliation, shoulder massage, serum and moisturiser.' },
      { id: 'radiance', cat: 'Facials', name: 'Recipe for Radiance Relaxation Facial', min: 45, buffer: 15, price: 70, active: true, desc: 'Aromatherapy facial with double cleanse, tone, exfoliation and mask, a chest, neck, shoulder and scalp massage, serum and moisturiser.' },
      { id: 'tension', cat: 'Massage', name: 'Tension Melt Back, Neck & Shoulder Massage', min: 30, buffer: 15, price: 50, active: true, desc: 'Focused massage to ease tight backs, necks and shoulders.' },
      { id: 'scalp', cat: 'Massage', name: 'Ultimate Relaxation Scalp, Neck & Shoulder Massage', min: 30, buffer: 15, price: 50, active: true, desc: 'Slow, soothing massage for the scalp, neck and shoulders.' },
      { id: 'recipe', cat: 'Massage', name: 'Recipe for Relaxation Massage', min: 45, buffer: 15, price: 70, active: true, desc: 'Back, neck, shoulder and scalp massage.' },
      { id: 'full', cat: 'Massage', name: 'Relax & Unwind Full Body Massage', min: 60, buffer: 15, price: 80, active: true, heavy: true, desc: 'A full body massage from head to toe.' },
      { id: 'classic', cat: 'Japanese Head Spa', name: 'The Classic Renewal', min: 60, buffer: 15, price: 90, head: true, rooms: ['headspa'], active: true, desc: 'Traditional Japanese scalp massage with deep cleansing and nourishing scalp care.' },
      { id: 'ritual', cat: 'Japanese Head Spa', name: 'The Radiance Ritual', min: 70, buffer: 15, price: 115, head: true, rooms: ['headspa'], active: true, desc: 'An extended head spa with a mini facial.' },
      { id: 'zen', cat: 'Japanese Head Spa', name: 'The Ultimate Zen Experience', min: 80, buffer: 15, price: 145, head: true, rooms: ['headspa'], active: true, desc: 'Deep scalp renewal with a bespoke facial, extended massage and premium botanical serums.' }
    ],
    // Treatment rooms (where treatments happen). tags let a treatment need a certain room (e.g. the head spa bed).
    treatRooms: [
      { id: 'tr1', name: 'Treatment room 1', beds: 2, tags: ['headspa'], active: true },
      { id: 'tr2', name: 'Treatment room 2', beds: 1, tags: [], active: true }
    ],
    // Bedrooms for stays. The website lists 8 bedrooms for up to 16 guests (5 king, 2 double, 2 single beds).
    rooms: [
      { id: 'r1', name: 'Room 1', bed: 'King', people: 2, ensuite: true, forBreaks: true, active: true },
      { id: 'r2', name: 'Room 2', bed: 'King', people: 2, ensuite: true, forBreaks: true, active: true },
      { id: 'r3', name: 'Room 3', bed: 'King', people: 2, ensuite: true, forBreaks: true, active: true },
      { id: 'r4', name: 'Room 4', bed: 'King', people: 2, ensuite: true, forBreaks: true, active: true },
      { id: 'r5', name: 'Room 5', bed: 'King', people: 2, ensuite: true, forBreaks: true, active: true },
      { id: 'r6', name: 'Room 6', bed: 'Double', people: 2, ensuite: false, forBreaks: false, building: 'The Annex', active: true },
      { id: 'r7', name: 'Room 7', bed: 'Double', people: 2, ensuite: false, forBreaks: false, building: 'The Annex', active: true },
      { id: 'r8', name: 'Room 8', bed: '2 singles', people: 2, ensuite: false, forBreaks: false, building: 'The Annex', active: true }
    ],
    // Date prices: special rates or stop-sell for a product over dates (e.g. peak weekends).
    rates: [],
    // Two therapists who can do every treatment (rename them and adjust hours in Staff).
    // Between them they cover spa days 09:30-17:00 every day and the spa-break evenings Wednesday to Sunday.
    staff: [
      { id: 's1', name: 'Therapist 1', role: 'Spa therapist', colour: '#b4785a', email: '', phone: '', active: true, priority: 1, maxHands: 360, holidayDays: 28,
        treatments: ['inc-massage', 'inc-facial', 'inc-lux-facial', 'basics', 'radiance', 'tension', 'scalp', 'recipe', 'full', 'classic', 'ritual', 'zen'],
        pattern: { 1: { shifts: [{ start: '09:00', end: '18:00' }], breaks: [] }, 2: { shifts: [{ start: '09:00', end: '18:00' }], breaks: [] }, 3: { shifts: [{ start: '09:00', end: '18:00' }], breaks: [] },
          4: { shifts: [{ start: '09:00', end: '18:00' }], breaks: [] }, 5: { shifts: [{ start: '09:00', end: '18:00' }], breaks: [] } } },
      { id: 's2', name: 'Therapist 2', role: 'Spa therapist', colour: '#5d7a63', email: '', phone: '', active: true, priority: 2, maxHands: 360, holidayDays: 28,
        treatments: ['inc-massage', 'inc-facial', 'inc-lux-facial', 'basics', 'radiance', 'tension', 'scalp', 'recipe', 'full', 'classic', 'ritual', 'zen'],
        pattern: { 0: { shifts: [{ start: '11:00', end: '22:30' }], breaks: [] }, 3: { shifts: [{ start: '13:00', end: '22:00' }], breaks: [] }, 4: { shifts: [{ start: '13:00', end: '22:00' }], breaks: [] },
          5: { shifts: [{ start: '09:00', end: '18:00' }], breaks: [] }, 6: { shifts: [{ start: '09:00', end: '18:00' }], breaks: [] } } }
    ],
    // Discount codes. banner: shows an offer bar on the website between its dates.
    promos: [],
    emails: {
      fromName: 'York Cottage Spa', replyTo: 'info@yorkcottagespa.com',
      preArrivalDays: 3, reviewDays: 2, balanceReminderDays: 7,
      templates: {
        confirm: { on: true, subject: 'Your York Cottage booking {ref}', body: 'Hello {first},\n\nThank you for booking {product} on {when}.\n\n{details}\n\nTotal {total} · paid {paid}{balanceLine}\n\nWe look forward to seeing you.\nYork Cottage Spa · 01933 580 100' },
        pay: { on: true, subject: 'Please pay for your York Cottage booking {ref}', body: 'Hello {first},\n\nWe’ve put together your booking for {product} on {when}.\n\n{details}\n\nTo confirm it, please pay {due} here:\n{payLink}\n\nThe link works for 7 days.\nYork Cottage Spa · 01933 580 100' },
        preArrival: { on: true, subject: 'See you soon at York Cottage', body: 'Hello {first},\n\nWe’re looking forward to welcoming you on {when}.\n\n{details}\n\nPlease complete your consultation form before you arrive: {consultLink}\nBring swimwear; towels, robes and slippers are waiting for you. Parking is free.\nDirections: just after the national speed limit signs leaving Bozeat towards Easton Maudit.\n\nYork Cottage Spa · 01933 580 100' },
        review: { on: true, subject: 'Thank you for visiting York Cottage', body: 'Hello {first},\n\nThank you for visiting us. We’d love to hear how it went: {reviewLink}\n\nYork Cottage Spa' },
        balance: { on: true, subject: 'Your balance for {ref} is due soon', body: 'Hello {first},\n\nThe balance of {due} for your stay on {when} is due by {dueDate}.\nPay here: {payLink}\n\nYork Cottage Spa' },
        changed: { on: true, subject: 'Your York Cottage booking {ref} has changed', body: 'Hello {first},\n\nWe’ve updated your booking. Here are your new details:\n\n{details}\n\nIf anything doesn’t look right, just reply to this email or call 01933 580 100.\nYork Cottage Spa' },
        cancel: { on: true, subject: 'Your York Cottage booking {ref} is cancelled', body: 'Hello {first},\n\nYour booking {ref} for {when} has been cancelled.{reasonLine}{refundLine}\n\n{message}\n\nYork Cottage Spa · 01933 580 100' },
        dayOf: { on: true, subject: 'Today at York Cottage', body: 'Hello {first},\n\nWe’re looking forward to seeing you today.\n\n{details}\n\nWhat to bring: swimwear and flip-flops. We provide robes and towels.\nFind us: Easton Lane, Bozeat NN29 7NN\n\nManage your booking: {manageLink}\n\nYork Cottage Spa · 01933 580 100' },
        voucherExpiry: { on: true, subject: 'Your York Cottage gift voucher expires soon', body: 'Hello {name},\n\nA reminder that gift voucher {code} has {balance} left on it and expires on {expires}.\n\nBook online and enter the code when you pay: {site}book.html\n\nYork Cottage Spa · 01933 580 100' },
        waitlist: { on: true, subject: 'A space has come up at York Cottage', body: 'Hello {first},\n\nGood news: a space has come up for {product} on {when} for {guests}.\n\nWe’re letting you know first. Book it here before someone else does: {bookLink}\n\nIf we don’t hear from you by {until}, we’ll offer it to the next person waiting.\n\nYork Cottage Spa · 01933 580 100' },
        voucher: { on: true, subject: 'Your York Cottage gift voucher', body: 'Hello {name},\n\nHere is your gift voucher: {code}\nValue: {value} · valid until {expires}\n\nYork Cottage Spa' }
      }
    },
    // text messages (user 2026-11-27): switched on here for the whole platform; each booking says email, text or both.
    // Sent by the data job through Twilio (secrets TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, optional SMS_FROM).
    sms: { on: false, sender: 'YorkCottage', off: {}, templates: {
      confirm: 'York Cottage: you’re booked for {product} on {when} (ref {ref}). Manage it: {manageLink}',
      preArrival: 'York Cottage: see you on {when}. {consultLine}Manage your booking: {manageLink}',
      dayOf: 'York Cottage: we look forward to seeing you today. {arrive}Questions? Call {phone}',
      changed: 'York Cottage: your booking {ref} has changed. New details: {manageLink}',
      cancel: 'York Cottage: your booking {ref} for {when} is cancelled.',
      balance: 'York Cottage: the balance of {due} for {ref} is due by {dueDate}. Pay here: {payLink}',
      review: 'Thank you for visiting York Cottage. We’d love a review: {reviewLink}',
      waitlist: 'York Cottage: a space has come up for {product} on {when}. Book before {until}: {bookLink}' } },
    // alerts to the team (user 2026-11-27): new bookings and booking requests to the manager, schedule changes to each therapist
    alerts: { email: '', newBooking: true, requests: true, therapists: true },
    policies: {
      spa: 'Spa days are paid in full and are non-refundable. You can move your visit (subject to availability) by emailing us at least 30 days before.',
      stay: 'Spa breaks can be refunded if you cancel at least 30 days before arrival. With less notice the full cost is charged, and there are no refunds for leaving early.',
      house: '50% is paid now and the balance 6 weeks before arrival (bookings within 6 weeks are paid in full). Cancel 6+ months ahead and you can move your dates; 6+ weeks ahead, the deposit is kept; under 6 weeks, the full cost is kept. A £500 damage deposit is pre-authorised on your card and released within 48 hours of departure.'
    },
    vouchers: {
      validMonths: 12,
      products: [
        { id: 'day1', name: 'Day Spa gift voucher', price: 90, was: 100, value: 100, product: 'day', guests: 1, active: true },
        { id: 'day2', name: 'Day Spa for Two gift voucher', price: 181, was: 200, value: 200, product: 'day', guests: 2, active: true },
        { id: 'break2', name: 'Ensuite Spa Break for 2 gift voucher', price: 290, value: 290, product: 'break', guests: 2, active: true }
      ]
    },
    // website gallery (user 2026-11-27): edited in the admin (Set-up → Gallery). src = the picture shown, full = the big one
    gallery: [{"id": "g1", "full": "https://static.wixstatic.com/media/7a9273_3128e98839d246529de17f99846a2b2a~mv2.jpg/v1/fit/w_2000,h_2000,q_80,enc_auto/7a9273_3128e98839d246529de17f99846a2b2a~mv2.jpg", "src": "https://static.wixstatic.com/media/7a9273_3128e98839d246529de17f99846a2b2a~mv2.jpg/v1/fit/w_800,h_800,q_80,enc_auto/7a9273_3128e98839d246529de17f99846a2b2a~mv2.jpg", "alt": "Morning sun through the trees at the front of the cottage", "tags": ["outside", "garden"]}, {"id": "g2", "full": "https://static.wixstatic.com/media/7a9273_cdf5c47efec5473fb3957a7d5adeb3ac~mv2.jpg/v1/fit/w_2000,h_2000,q_80,enc_auto/7a9273_cdf5c47efec5473fb3957a7d5adeb3ac~mv2.jpg", "src": "https://static.wixstatic.com/media/7a9273_cdf5c47efec5473fb3957a7d5adeb3ac~mv2.jpg/v1/fit/w_800,h_800,q_80,enc_auto/7a9273_cdf5c47efec5473fb3957a7d5adeb3ac~mv2.jpg", "alt": "The pool lounge, with armchairs beside the indoor pool and the garden beyond", "tags": ["spa", "pool", "relax"]}, {"id": "g3", "full": "https://static.wixstatic.com/media/7a9273_91aab4999b9e42e3a69a8f37c6e7c272~mv2.jpg/v1/fit/w_2000,h_2000,q_80,enc_auto/7a9273_91aab4999b9e42e3a69a8f37c6e7c272~mv2.jpg", "src": "https://static.wixstatic.com/media/7a9273_91aab4999b9e42e3a69a8f37c6e7c272~mv2.jpg/v1/fit/w_800,h_800,q_80,enc_auto/7a9273_91aab4999b9e42e3a69a8f37c6e7c272~mv2.jpg", "alt": "York Cottage across the lawn on a sunny day", "tags": ["outside", "garden", "cottage", "summer"]}, {"id": "g4", "full": "https://static.wixstatic.com/media/7a9273_bd0a45f992774bccb26756818d10e7de~mv2.jpg/v1/fit/w_2000,h_2000,q_80,enc_auto/7a9273_bd0a45f992774bccb26756818d10e7de~mv2.jpg", "src": "https://static.wixstatic.com/media/7a9273_bd0a45f992774bccb26756818d10e7de~mv2.jpg/v1/fit/w_800,h_800,q_80,enc_auto/7a9273_bd0a45f992774bccb26756818d10e7de~mv2.jpg", "alt": "Loungers beside the indoor pool, with fresh fruit water", "tags": ["spa", "pool", "relax"]}, {"id": "g5", "full": "https://static.wixstatic.com/media/7a9273_b97fa262c0ab4429b85da5892b5850c4~mv2.jpg/v1/fit/w_2000,h_2000,q_80,enc_auto/7a9273_b97fa262c0ab4429b85da5892b5850c4~mv2.jpg", "src": "https://static.wixstatic.com/media/7a9273_b97fa262c0ab4429b85da5892b5850c4~mv2.jpg/v1/fit/w_800,h_800,q_80,enc_auto/7a9273_b97fa262c0ab4429b85da5892b5850c4~mv2.jpg", "alt": "The spa: a long, light room with daybeds, the pool and the hot tub", "tags": ["spa", "relax", "pool"]}, {"id": "g6", "full": "https://static.wixstatic.com/media/7a9273_449e06a871aa4ab0803ceb38eece1bf6~mv2.jpg/v1/fit/w_2000,h_2000,q_80,enc_auto/7a9273_449e06a871aa4ab0803ceb38eece1bf6~mv2.jpg", "src": "https://static.wixstatic.com/media/7a9273_449e06a871aa4ab0803ceb38eece1bf6~mv2.jpg/v1/fit/w_800,h_800,q_80,enc_auto/7a9273_449e06a871aa4ab0803ceb38eece1bf6~mv2.jpg", "alt": "Rosemary-infused water in the relaxation room", "tags": ["spa", "relax", "food & drink"]}, {"id": "g7", "full": "https://static.wixstatic.com/media/7a9273_f25c24e7a8f44c76baf4b942f30590eb~mv2.jpg/v1/fit/w_2000,h_2000,q_80,enc_auto/7a9273_f25c24e7a8f44c76baf4b942f30590eb~mv2.jpg", "src": "https://static.wixstatic.com/media/7a9273_f25c24e7a8f44c76baf4b942f30590eb~mv2.jpg/v1/fit/w_800,h_800,q_80,enc_auto/7a9273_f25c24e7a8f44c76baf4b942f30590eb~mv2.jpg", "alt": "A colourful grazing board of fruit, crudités, breadsticks and treats", "tags": ["food & drink", "events"]}, {"id": "g8", "full": "https://static.wixstatic.com/media/7a9273_3760b75ab67f40fe8a273b9fae32d4bf~mv2.jpg/v1/fit/w_2000,h_2000,q_80,enc_auto/7a9273_3760b75ab67f40fe8a273b9fae32d4bf~mv2.jpg", "src": "https://static.wixstatic.com/media/7a9273_3760b75ab67f40fe8a273b9fae32d4bf~mv2.jpg/v1/fit/w_800,h_800,q_80,enc_auto/7a9273_3760b75ab67f40fe8a273b9fae32d4bf~mv2.jpg", "alt": "A grazing board with brownies, berries and cheeses", "tags": ["food & drink", "events"]}, {"id": "g9", "full": "https://static.wixstatic.com/media/7a9273_ab85ef499c1e41718ef838197bfe44ed~mv2.jpg/v1/fit/w_2000,h_2000,q_80,enc_auto/7a9273_ab85ef499c1e41718ef838197bfe44ed~mv2.jpg", "src": "https://static.wixstatic.com/media/7a9273_ab85ef499c1e41718ef838197bfe44ed~mv2.jpg/v1/fit/w_800,h_800,q_80,enc_auto/7a9273_ab85ef499c1e41718ef838197bfe44ed~mv2.jpg", "alt": "Afternoon tea with sandwiches, scones and cakes", "tags": ["food & drink", "afternoon tea"]}, {"id": "g10", "full": "https://static.wixstatic.com/media/7a9273_281c0d1bc05e4b329f67a9d257f24ca1~mv2.jpg/v1/fit/w_2000,h_2000,q_80,enc_auto/7a9273_281c0d1bc05e4b329f67a9d257f24ca1~mv2.jpg", "src": "https://static.wixstatic.com/media/7a9273_281c0d1bc05e4b329f67a9d257f24ca1~mv2.jpg/v1/fit/w_800,h_800,q_80,enc_auto/7a9273_281c0d1bc05e4b329f67a9d257f24ca1~mv2.jpg", "alt": "The sitting room, with a grand piano and an open fireplace", "tags": ["cottage", "inside", "stay"]}, {"id": "g11", "full": "https://static.wixstatic.com/media/7a9273_7586b6b2ac694ae5b57bf3f571a4201f~mv2.jpg/v1/fit/w_2000,h_2000,q_80,enc_auto/7a9273_7586b6b2ac694ae5b57bf3f571a4201f~mv2.jpg", "src": "https://static.wixstatic.com/media/7a9273_7586b6b2ac694ae5b57bf3f571a4201f~mv2.jpg/v1/fit/w_800,h_800,q_80,enc_auto/7a9273_7586b6b2ac694ae5b57bf3f571a4201f~mv2.jpg", "alt": "A four-poster bedroom with a sofa bed", "tags": ["bedroom", "stay"]}, {"id": "g12", "full": "https://static.wixstatic.com/media/7a9273_6598de2d84f849188386e0070f6f06f4~mv2.jpg/v1/fit/w_2000,h_2000,q_80,enc_auto/7a9273_6598de2d84f849188386e0070f6f06f4~mv2.jpg", "src": "https://static.wixstatic.com/media/7a9273_6598de2d84f849188386e0070f6f06f4~mv2.jpg/v1/fit/w_800,h_800,q_80,enc_auto/7a9273_6598de2d84f849188386e0070f6f06f4~mv2.jpg", "alt": "A bright bedroom with a double bed and a dressing table", "tags": ["bedroom", "stay"]}, {"id": "g13", "full": "https://static.wixstatic.com/media/7a9273_eadaa48d53664c57b5f52afaf68e8990~mv2.jpg/v1/fit/w_2000,h_2000,q_80,enc_auto/7a9273_eadaa48d53664c57b5f52afaf68e8990~mv2.jpg", "src": "https://static.wixstatic.com/media/7a9273_eadaa48d53664c57b5f52afaf68e8990~mv2.jpg/v1/fit/w_800,h_800,q_80,enc_auto/7a9273_eadaa48d53664c57b5f52afaf68e8990~mv2.jpg", "alt": "The dining room laid for a group meal", "tags": ["dining", "events", "groups"]}, {"id": "g14", "full": "https://static.wixstatic.com/media/7a9273_7374d8bf508e4df6a3fa942b224841eb~mv2.jpg/v1/fit/w_2000,h_2000,q_80,enc_auto/7a9273_7374d8bf508e4df6a3fa942b224841eb~mv2.jpg", "src": "https://static.wixstatic.com/media/7a9273_7374d8bf508e4df6a3fa942b224841eb~mv2.jpg/v1/fit/w_800,h_800,q_80,enc_auto/7a9273_7374d8bf508e4df6a3fa942b224841eb~mv2.jpg", "alt": "The long dining table laid for a celebration", "tags": ["dining", "events", "groups"]}, {"id": "g15", "full": "https://static.wixstatic.com/media/7a9273_3f807f5d1e064d96829173cc8305fb46~mv2.jpg/v1/fit/w_2000,h_2000,q_80,enc_auto/7a9273_3f807f5d1e064d96829173cc8305fb46~mv2.jpg", "src": "https://static.wixstatic.com/media/7a9273_3f807f5d1e064d96829173cc8305fb46~mv2.jpg/v1/fit/w_800,h_800,q_80,enc_auto/7a9273_3f807f5d1e064d96829173cc8305fb46~mv2.jpg", "alt": "The garden and orchard in summer", "tags": ["outside", "garden", "summer"]}, {"id": "g16", "full": "https://static.wixstatic.com/media/7a9273_874f286fc3f74d969cf137652e054956~mv2.jpg/v1/fit/w_2000,h_2000,q_80,enc_auto/7a9273_874f286fc3f74d969cf137652e054956~mv2.jpg", "src": "https://static.wixstatic.com/media/7a9273_874f286fc3f74d969cf137652e054956~mv2.jpg/v1/fit/w_800,h_800,q_80,enc_auto/7a9273_874f286fc3f74d969cf137652e054956~mv2.jpg", "alt": "The brick barn in the grounds", "tags": ["outside", "stay"]}, {"id": "g17", "full": "https://static.wixstatic.com/media/7a9273_e095a661715a43cf8120670cdbc422f9~mv2.jpg/v1/fit/w_2000,h_2000,q_80,enc_auto/7a9273_e095a661715a43cf8120670cdbc422f9~mv2.jpg", "src": "https://static.wixstatic.com/media/7a9273_e095a661715a43cf8120670cdbc422f9~mv2.jpg/v1/fit/w_800,h_800,q_80,enc_auto/7a9273_e095a661715a43cf8120670cdbc422f9~mv2.jpg", "alt": "An open-plan kitchen, dining and living room", "tags": ["inside", "stay", "groups"]}, {"id": "g18", "full": "https://static.wixstatic.com/media/7a9273_c527bfae78d645c096615f66806d3b0f~mv2.jpg/v1/fit/w_2000,h_2000,q_80,enc_auto/7a9273_c527bfae78d645c096615f66806d3b0f~mv2.jpg", "src": "https://static.wixstatic.com/media/7a9273_c527bfae78d645c096615f66806d3b0f~mv2.jpg/v1/fit/w_800,h_800,q_80,enc_auto/7a9273_c527bfae78d645c096615f66806d3b0f~mv2.jpg", "alt": "The spa from the far end, with the hot tub and garden views", "tags": ["spa", "pool", "relax"]}, {"id": "g19", "full": "https://static.wixstatic.com/media/7a9273_372efc1386f3463b863c2d3b93d28915~mv2.jpg/v1/fit/w_2000,h_2000,q_80,enc_auto/7a9273_372efc1386f3463b863c2d3b93d28915~mv2.jpg", "src": "https://static.wixstatic.com/media/7a9273_372efc1386f3463b863c2d3b93d28915~mv2.jpg/v1/fit/w_800,h_800,q_80,enc_auto/7a9273_372efc1386f3463b863c2d3b93d28915~mv2.jpg", "alt": "A double bedroom with gold cushions", "tags": ["bedroom", "stay"]}, {"id": "g20", "full": "https://static.wixstatic.com/media/7a9273_0d4c7e4ef4b64cbe90d5ef7129fe30fd~mv2.jpg/v1/fit/w_2000,h_2000,q_80,enc_auto/7a9273_0d4c7e4ef4b64cbe90d5ef7129fe30fd~mv2.jpg", "src": "https://static.wixstatic.com/media/7a9273_0d4c7e4ef4b64cbe90d5ef7129fe30fd~mv2.jpg/v1/fit/w_800,h_800,q_80,enc_auto/7a9273_0d4c7e4ef4b64cbe90d5ef7129fe30fd~mv2.jpg", "alt": "An orchid beside the hot tub", "tags": ["spa", "relax"]}],
    bankHolidays: ['2026-12-25', '2026-12-28', '2027-01-01', '2027-03-26', '2027-03-29', '2027-05-03', '2027-05-31', '2027-08-30', '2027-12-27', '2027-12-28']
  };
  if (typeof module !== 'undefined') module.exports = D; else root.YC_DEFAULTS = D;
})(this);
