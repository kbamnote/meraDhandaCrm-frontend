/**
 * PermissionsPage — admin user management.
 *
 * - "+ Add Teammate" creates a new user (email + password + role) via authApi.createUser.
 * - Real-time list of every user (onValue mpw/users) with an inline role editor
 *   (built-in role select + designation picked from the list) that calls
 *   authApi.setRole.
 * - "Designations" panel: the company's list of job titles (add / rename /
 *   delete). A designation is a label only — permissions stay per person.
 * All write controls require admin / superadmin / owner.
 */
import { useEffect, useMemo, useState } from 'react';
import { ref, onValue, db } from '../services/realtime';
import { authApi } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useT, useLang } from '../i18n/LanguageContext';
import { showToast } from '../components/common/toast';
import SalaryHikeModal from '../components/common/SalaryHikeModal';
import { canViewModule, PERMISSION_CATALOG } from '../config/access';

const S = {
  permissionsTeam: { en: '🔐 Permissions & Team', hi: '🔐 परमिशन और टीम', hinglish: '🔐 Permissions & Team', gu: '🔐 પરમિશન અને ટીમ', mr: '🔐 परवानग्या आणि टीम', mwr: '🔐 परमिशन अर टीम' },
  user: { en: 'user', hi: 'यूज़र', hinglish: 'user', gu: 'યૂઝર', mr: 'युझर', mwr: 'यूज़र' },
  users: { en: 'users', hi: 'यूज़र', hinglish: 'users', gu: 'યૂઝર', mr: 'युझर', mwr: 'यूज़र' },
  readOnly: { en: 'read-only', hi: 'सिर्फ़ देखने के लिए', hinglish: 'read-only', gu: 'ફક્ત વાંચવા માટે', mr: 'फक्त वाचनीय', mwr: 'सिरफ देखण खातर' },
  addTeammate: { en: '+ Add Teammate', hi: '+ टीममेट जोड़ें', hinglish: '+ Teammate add karein', gu: '+ ટીમમેટ ઉમેરો', mr: '+ टीममेट जोडा', mwr: '+ टीममेट जोड़ो' },
  searchPlaceholder: { en: '🔍 Search by name, email, role...', hi: '🔍 नाम, ईमेल, रोल से खोजें...', hinglish: '🔍 Naam, email, role se search karein...', gu: '🔍 નામ, ઈમેલ, રોલથી શોધો...', mr: '🔍 नाव, ईमेल, भूमिकेने शोधा...', mwr: '🔍 नाम, ईमेल, रोल सूं ढूंढो...' },
  noUsers: { en: 'No users yet. Click “+ Add Teammate” to create the first one.', hi: 'अभी तक कोई यूज़र नहीं। पहला बनाने के लिए “+ टीममेट जोड़ें” पर क्लिक करें।', hinglish: 'Abhi tak koi user nahi. Pehla banane ke liye “+ Add Teammate” par click karein.', gu: 'હજુ સુધી કોઈ યૂઝર નથી. પહેલો બનાવવા “+ ટીમમેટ ઉમેરો” પર ક્લિક કરો.', mr: 'अद्याप कोणताही युझर नाही. पहिला तयार करण्यासाठी “+ टीममेट जोडा” वर क्लिक करा.', mwr: 'अजे तांई कोई यूज़र कोनी। पैलो बणावण खातर “+ टीममेट जोड़ो” पर क्लिक करो।' },
  thName: { en: 'Name', hi: 'नाम', hinglish: 'Naam', gu: 'નામ', mr: 'नाव', mwr: 'नाम' },
  thEmail: { en: 'Email', hi: 'ईमेल', hinglish: 'Email', gu: 'ઈમેલ', mr: 'ईमेल', mwr: 'ईमेल' },
  thCurrentRole: { en: 'Current role', hi: 'मौजूदा रोल', hinglish: 'Current role', gu: 'વર્તમાન રોલ', mr: 'सध्याची भूमिका', mwr: 'मौजूदा रोल' },
  thCustomRole: { en: 'Designation', hi: 'पद', hinglish: 'Designation', gu: 'હોદ્દો', mr: 'पद', mwr: 'पद' },
  designations: { en: '🏷 Designations', hi: '🏷 पद', hinglish: '🏷 Designations', gu: '🏷 હોદ્દા', mr: '🏷 पदे', mwr: '🏷 पद' },
  designationsHint: { en: 'Job titles you can give teammates. A designation is a label only — access is still set per person.', hi: 'टीममेट्स को दिए जा सकने वाले पद। पद केवल एक लेबल है — एक्सेस हर व्यक्ति के लिए अलग से सेट होता है।', hinglish: 'Teammates ko diye ja sakne wale job titles. Designation sirf label hai — access har person ke liye alag set hota hai.', gu: 'ટીમમેટ્સને આપી શકાય તેવા હોદ્દા. હોદ્દો માત્ર લેબલ છે — ઍક્સેસ દરેક વ્યક્તિ માટે અલગ સેટ થાય છે.', mr: 'टीममेट्सना देता येणारी पदे. पद फक्त लेबल आहे — ॲक्सेस प्रत्येक व्यक्तीसाठी वेगळा सेट होतो.', mwr: 'टीममेट्स ने दिया जा सके वाला पद। पद सिर्फ लेबल है — एक्सेस हर मिनख खातर अलग सेट होवे।' },
  newDesignation: { en: 'New designation, e.g. Machine Operator', hi: 'नया पद, जैसे मशीन ऑपरेटर', hinglish: 'Naya designation, jaise Machine Operator', gu: 'નવો હોદ્દો, દા.ત. મશીન ઓપરેટર', mr: 'नवीन पद, उदा. मशीन ऑपरेटर', mwr: 'नयो पद, जियां मशीन ऑपरेटर' },
  addDesignation: { en: '+ Add', hi: '+ जोड़ें', hinglish: '+ Add', gu: '+ ઉમેરો', mr: '+ जोडा', mwr: '+ जोड़ो' },
  people: { en: 'people', hi: 'लोग', hinglish: 'log', gu: 'લોકો', mr: 'लोक', mwr: 'मिनख' },
  rename: { en: 'Rename', hi: 'नाम बदलें', hinglish: 'Rename', gu: 'નામ બદલો', mr: 'नाव बदला', mwr: 'नाम बदळो' },
  noDesignations: { en: 'No designations yet — add the first one above.', hi: 'अभी कोई पद नहीं — ऊपर पहला जोड़ें।', hinglish: 'Abhi koi designation nahi — upar pehla add karein.', gu: 'હજુ કોઈ હોદ્દો નથી — ઉપર પહેલો ઉમેરો.', mr: 'अद्याप पद नाही — वर पहिले जोडा.', mwr: 'अजे कोई पद कोनी — ऊपर पैलो जोड़ो।' },
  noDesignation: { en: '— No designation —', hi: '— कोई पद नहीं —', hinglish: '— Koi designation nahi —', gu: '— કોઈ હોદ્દો નહીં —', mr: '— पद नाही —', mwr: '— कोई पद कोनी —' },
  renamePrompt: { en: 'New name for this designation (everyone who has it will be updated):', hi: 'इस पद का नया नाम (जिनके पास यह है, सबका बदल जाएगा):', hinglish: 'Is designation ka naya naam (jinke paas yeh hai, sabka update hoga):', gu: 'આ હોદ્દાનું નવું નામ (જેમની પાસે છે તે બધાનું બદલાશે):', mr: 'या पदाचे नवीन नाव (ज्यांच्याकडे आहे त्या सर्वांचे बदलेल):', mwr: 'इण पद रो नयो नाम (जिकां कने है, सगळां रो बदळ जासी):' },
  deleteConfirm: { en: 'Delete this designation? It will be removed from', hi: 'यह पद हटाएं? यह हटाया जाएगा', hinglish: 'Yeh designation delete karein? Isse hataya jayega', gu: 'આ હોદ્દો કાઢી નાખીએ? તે દૂર થશે', mr: 'हे पद हटवायचे? ते काढले जाईल', mwr: 'यो पद हटावां? यो हटायो जासी' },
  saved: { en: 'Saved', hi: 'सेव हो गया', hinglish: 'Save ho gaya', gu: 'સેવ થયું', mr: 'सेव्ह झाले', mwr: 'सेव हो ग्यो' },
  notSaved: { en: 'in use — not on the list yet', hi: 'उपयोग में — अभी सूची में नहीं', hinglish: 'use me hai — list me nahi', gu: 'વપરાશમાં — હજુ યાદીમાં નથી', mr: 'वापरात — अद्याप यादीत नाही', mwr: 'काम में — अजे लिस्ट में कोनी' },
  thChangeRole: { en: 'Change role', hi: 'रोल बदलें', hinglish: 'Role change karein', gu: 'રોલ બદલો', mr: 'भूमिका बदला', mwr: 'रोल बदलो' },
  roleUpdated: { en: 'Role updated', hi: 'रोल अपडेट हो गया', hinglish: 'Role update ho gaya', gu: 'રોલ અપડેટ થયો', mr: 'भूमिका अपडेट झाली', mwr: 'रोल अपडेट हो ग्यो' },
  failed: { en: 'Failed', hi: 'नहीं हुआ', hinglish: 'Fail hua', gu: 'નિષ્ફળ', mr: 'अयशस्वी', mwr: 'कोनी हुयो' },
  saving: { en: 'Saving…', hi: 'सेव हो रहा है…', hinglish: 'Save ho raha hai…', gu: 'સેવ થઈ રહ્યું છે…', mr: 'सेव होत आहे…', mwr: 'सेव हो रियो है…' },
  save: { en: 'Save', hi: 'सेव करें', hinglish: 'Save karein', gu: 'સેવ કરો', mr: 'सेव करा', mwr: 'सेव करो' },

  emailRequired: { en: 'Email is required', hi: 'ईमेल ज़रूरी है', hinglish: 'Email zaroori hai', gu: 'ઈમેલ જરૂરી છે', mr: 'ईमेल आवश्यक आहे', mwr: 'ईमेल जरूरी है' },
  passwordMin: { en: 'Password must be at least 6 characters', hi: 'पासवर्ड कम से कम 6 अक्षर का होना चाहिए', hinglish: 'Password kam se kam 6 characters ka hona chahiye', gu: 'પાસવર્ડ ઓછામાં ઓછા 6 અક્ષરનો હોવો જોઈએ', mr: 'पासवर्ड किमान 6 अक्षरांचा असावा', mwr: 'पासवर्ड कम सूं कम 6 अक्षर रो होणो चाइजे' },
  teammateCreatedPrefix: { en: 'Teammate', hi: 'टीममेट', hinglish: 'Teammate', gu: 'ટીમમેટ', mr: 'टीममेट', mwr: 'टीममेट' },
  teammateCreatedSuffix: { en: 'created', hi: 'बन गया', hinglish: 'create ho gaya', gu: 'બન્યો', mr: 'तयार झाला', mwr: 'बण ग्यो' },
  createFailed: { en: 'Failed to create teammate', hi: 'टीममेट नहीं बना', hinglish: 'Teammate nahi bana', gu: 'ટીમમેટ બનાવવામાં નિષ્ફળ', mr: 'टीममेट तयार करता आला नाही', mwr: 'टीममेट कोनी बण्यो' },
  fullName: { en: 'Full name', hi: 'पूरा नाम', hinglish: 'Full name', gu: 'પૂરું નામ', mr: 'पूर्ण नाव', mwr: 'पूरो नाम' },
  emailStar: { en: 'Email *', hi: 'ईमेल *', hinglish: 'Email *', gu: 'ઈમેલ *', mr: 'ईमेल *', mwr: 'ईमेल *' },
  emailPlaceholder: { en: 'teammate@company.com', hi: 'teammate@company.com', hinglish: 'teammate@company.com', gu: 'teammate@company.com', mr: 'teammate@company.com', mwr: 'teammate@company.com' },
  tempPassword: { en: 'Temporary password * (min 6 chars)', hi: 'अस्थायी पासवर्ड * (कम से कम 6 अक्षर)', hinglish: 'Temporary password * (min 6 chars)', gu: 'કામચલાઉ પાસવર્ડ * (ઓછામાં ઓછા 6 અક્ષર)', mr: 'तात्पुरता पासवर्ड * (किमान 6 अक्षरे)', mwr: 'अस्थायी पासवर्ड * (कम सूं कम 6 अक्षर)' },
  passwordPlaceholder: { en: 'they can change it later', hi: 'वे बाद में बदल सकते हैं', hinglish: 'wo baad mein change kar sakte hain', gu: 'તેઓ પછી બદલી શકે છે', mr: 'ते नंतर बदलू शकतात', mwr: 'वे पछै बदल सको है' },
  role: { en: 'Role', hi: 'रोल', hinglish: 'Role', gu: 'રોલ', mr: 'भूमिका', mwr: 'रोल' },
  employeeId: { en: 'Employee ID', hi: 'कर्मचारी ID', hinglish: 'Employee ID', gu: 'કર્મચારી ID', mr: 'कर्मचारी ID', mwr: 'कर्मचारी ID' },
  employeeIdHint: { en: 'Your own staff number — EMP-014, 2219, anything. Leave blank if you don\'t use one.', hi: 'आपका अपना स्टाफ नंबर — खाली छोड़ सकते हैं।', hinglish: 'Aapka apna staff number — khaali chhod sakte hain.', gu: 'તમારો સ્ટાફ નંબર — ખાલી રાખી શકો.', mr: 'तुमचा स्टाफ नंबर — रिकामा ठेवू शकता.', mwr: 'थांरो स्टाफ नंबर — खाली छोड़ सको।' },
  department: { en: 'Department', hi: 'विभाग', hinglish: 'Department', gu: 'વિભાગ', mr: 'विभाग', mwr: 'विभाग' },
  creating: { en: 'Creating…', hi: 'बन रहा है…', hinglish: 'Create ho raha hai…', gu: 'બની રહ્યું છે…', mr: 'तयार होत आहे…', mwr: 'बण रियो है…' },
  createTeammate: { en: 'Create teammate', hi: 'टीममेट बनाएं', hinglish: 'Teammate banayein', gu: 'ટીમમેટ બનાવો', mr: 'टीममेट तयार करा', mwr: 'टीममेट बणावो' },
  cancel: { en: 'Cancel', hi: 'रद्द करें', hinglish: 'Cancel karein', gu: 'રદ કરો', mr: 'रद्द करा', mwr: 'रद्द करो' },
  shareHint: { en: 'Share the email + password with them. They sign in at the login page.', hi: 'उन्हें ईमेल + पासवर्ड दें। वे लॉगिन पेज पर साइन इन करेंगे।', hinglish: 'Unhe email + password dein. Wo login page par sign in karenge.', gu: 'તેમને ઈમેલ + પાસવર્ડ આપો. તેઓ લોગિન પેજ પર સાઇન ઇન કરશે.', mr: 'त्यांना ईमेल + पासवर्ड द्या. ते लॉगिन पेजवर साइन इन करतील.', mwr: 'उणने ईमेल + पासवर्ड दो। वे लॉगिन पेज पर साइन इन करसी।' },

  thAccess: { en: 'Access', hi: 'एक्सेस', hinglish: 'Access', gu: 'એક્સેસ', mr: 'अॅक्सेस', mwr: 'एक्सेस' },
  hike: { en: '📈 Hike', hi: '📈 बढ़ोतरी', hinglish: '📈 Hike', gu: '📈 વધારો', mr: '📈 वाढ', mwr: '📈 बढ़ोतरी' },
  thHike: { en: 'Salary', hi: 'सैलरी', hinglish: 'Salary', gu: 'પગાર', mr: 'पगार', mwr: 'सैलरी' },
  manageAccess: { en: '🔧 Access', hi: '🔧 एक्सेस', hinglish: '🔧 Access', gu: '🔧 એક્સેસ', mr: '🔧 अॅक्सेस', mwr: '🔧 एक्सेस' },
  edit: { en: 'Edit', hi: 'एडिट', hinglish: 'Edit', gu: 'એડિટ', mr: 'एडिट', mwr: 'एडिट' },
  editUser: { en: 'Edit user', hi: 'यूज़र एडिट करें', hinglish: 'User edit karein', gu: 'યૂઝર એડિટ કરો', mr: 'युझर एडिट करा', mwr: 'यूज़र एडिट करो' },
  active: { en: 'Active (can sign in)', hi: 'सक्रिय (लॉगिन कर सकता है)', hinglish: 'Active (login kar sakta hai)', gu: 'સક્રિય (લૉગિન કરી શકે)', mr: 'सक्रिय (लॉगिन करू शकतो)', mwr: 'सक्रिय (लॉगिन कर सके)' },
  newPassword: { en: 'New password (leave blank to keep current)', hi: 'नया पासवर्ड (खाली छोड़ने पर मौजूदा रहेगा)', hinglish: 'Naya password (blank chhodne par current rahega)', gu: 'નવો પાસવર્ડ (ખાલી રાખવાથી હાલનો જ રહેશે)', mr: 'नवीन पासवर्ड (रिकामे ठेवल्यास सध्याचाच राहील)', mwr: 'नयो पासवर्ड (खाली राखण पर मौजूदा रैहसे)' },
  userUpdated: { en: 'User updated', hi: 'यूज़र अपडेट हो गया', hinglish: 'User update ho gaya', gu: 'યૂઝર અપડેટ થયો', mr: 'युझर अपडेट झाला', mwr: 'यूज़र अपडेट हो ग्यो' },
  cannotDisableSelf: { en: 'You cannot deactivate your own account.', hi: 'आप अपना अकाउंट बंद नहीं कर सकते।', hinglish: 'Aap apna account band nahi kar sakte.', gu: 'તમે તમારું એકાઉન્ટ બંધ કરી શકતા નથી.', mr: 'तुम्ही तुमचे खाते बंद करू शकत नाही.', mwr: 'थम अपनो अकाउंट बंद नई कर सको।' },
  accessFor: { en: 'Module access', hi: 'मॉड्यूल एक्सेस', hinglish: 'Module access', gu: 'મોડ્યુલ એક્સેસ', mr: 'मॉड्यूल अॅक्सेस', mwr: 'मॉड्यूल एक्सेस' },
  canViewCol: { en: 'View', hi: 'देखें', hinglish: 'View', gu: 'જુઓ', mr: 'पाहा', mwr: 'देखो' },
  canEditCol: { en: 'Edit', hi: 'एडिट', hinglish: 'Edit', gu: 'એડિટ', mr: 'एडिट', mwr: 'एडिट' },
  manageCol: { en: 'Manage', hi: 'मैनेज', hinglish: 'Manage', gu: 'મેનેજ', mr: 'व्यवस्थापन', mwr: 'मैनेज' },
  accessSaved: { en: 'Access updated', hi: 'एक्सेस अपडेट हो गया', hinglish: 'Access update ho gaya', gu: 'એક્સેસ અપડેટ થયો', mr: 'अॅक्सेस अपडेट झाला', mwr: 'एक्सेस अपडेट हो ग्यो' },
  showAll: { en: 'Show all', hi: 'सब दिखाएं', hinglish: 'Sab dikhayein', gu: 'બધા બતાવો', mr: 'सर्व दाखवा', mwr: 'सगळा दिखावो' },
  hideAll: { en: 'Hide all', hi: 'सब छुपाएं', hinglish: 'Sab chhupayein', gu: 'બધા છુપાવો', mr: 'सर्व लपवा', mwr: 'सगळा छुपावो' },
  close: { en: 'Close', hi: 'बंद करें', hinglish: 'Close karein', gu: 'બંધ કરો', mr: 'बंद करा', mwr: 'बंद करो' },
  remove:        { en: 'Remove', hi: 'हटाएं', hinglish: 'Remove karein', gu: 'દૂર કરો', mr: 'हटवा', mwr: 'हटावो' },
  confirmRemove: { en: 'Permanently delete this staff member? This cannot be undone.', hi: 'क्या आप इस स्टाफ को हमेशा के लिए हटाना चाहते हैं? यह वापस नहीं होगा।', hinglish: 'Permanently delete karein? Yeh undo nahi hoga.', gu: 'આ સ્ટાફ સભ્યને કાયમ માટે ડિલીટ કરો? આ પૂર્વવત્ કરી શકાતું નથી.', mr: 'हा कर्मचारी कायमचा हटवायचा? हे पूर्ववत होणार नाही.', mwr: 'Permanently delete karein? Yeh undo nahi hoga.' },
  accessHint: { en: 'Switch a section ON so this teammate can see it; Edit also lets them create/change records (needs View). New staff start with only the basics; job roles already see their own sections. Admins & owners always have full access.', hi: 'सेक्शन ON करें ताकि यह टीममेट उसे देख सके; एडिट से रिकॉर्ड बना/बदल भी सकता है (देखें ज़रूरी)। नया स्टाफ सिर्फ़ बेसिक से शुरू होता है; जॉब रोल अपने सेक्शन पहले से देखते हैं। एडमिन/ओनर के पास हमेशा पूरा एक्सेस।', hinglish: 'Section ON karein taaki teammate use dekh sake; Edit se record bana/badal bhi sakta hai (View zaroori). Naya staff sirf basics se start hota hai; job roles apne section pehle se dekhte hain. Admin/owner ke paas hamesha full access.', gu: 'સેક્શન ON કરો જેથી આ ટીમમેટ તે જુએ; એડિટથી રેકોર્ડ બનાવી/બદલી શકે (જુઓ જરૂરી). નવો સ્ટાફ ફક્ત બેઝિકથી શરૂ થાય; જોબ રોલ પોતાના સેક્શન પહેલેથી જુએ. એડમિન/ઓનર પાસે હંમેશા સંપૂર્ણ એક્સેસ.', mr: 'सेक्शन ON करा जेणेकरून हा टीममेट तो पाहू शकेल; एडिटने रेकॉर्ड तयार/बदलू शकतो (पाहा आवश्यक). नवीन स्टाफ फक्त बेसिकने सुरू होतो; जॉब रोल त्यांचे सेक्शन आधीच पाहतात. अॅडमिन/ओनरकडे नेहमी पूर्ण अॅक्सेस.', mwr: 'सेक्शन ON करो ताकि यो टीममेट उणनै देख सकै; एडिट सूं रिकॉर्ड बणा/बदल सकै (देखो जरूरी). नयो स्टाफ सिरफ बेसिक सूं चालू होवै; जॉब रोल आपरा सेक्शन पैलां सूं देखै. एडमिन/ओनर कनै हमेसा पूरो एक्सेस.' },
};

// Group + feature labels for the grouped Permissions catalog (PERMISSION_CATALOG
// in config/access.js). Sensitive collections (users, companySettings…) stay
// admin/owner-only and the backend rejects granting them.
const GROUP_LABELS = {
  jobsProd: { en: 'Jobs & Production', hi: 'जॉब और प्रोडक्शन', hinglish: 'Jobs & Production' },
  salesCust: { en: 'Sales & Customers', hi: 'सेल्स और ग्राहक', hinglish: 'Sales & Customers' },
  accounting: { en: 'Accounting', hi: 'अकाउंटिंग', hinglish: 'Accounting' },
  hr: { en: 'HR', hi: 'एचआर', hinglish: 'HR' },
  workspace: { en: 'Workspace', hi: 'वर्कस्पेस', hinglish: 'Workspace' },
  tracking: { en: 'Field Tracking', hi: 'फील्ड ट्रैकिंग', hinglish: 'Field Tracking' },
};
const MODULE_LABELS = {
  jobs: { en: 'Job Cards', hi: 'जॉब कार्ड', hinglish: 'Job Cards' },
  completed: { en: 'Completed Jobs', hi: 'पूर्ण जॉब', hinglish: 'Completed Jobs' },
  hold: { en: 'Hold Jobs', hi: 'होल्ड जॉब', hinglish: 'Hold Jobs' },
  jobsetter: { en: 'Job Setter', hi: 'जॉब सेटर', hinglish: 'Job Setter' },
  analytics: { en: 'Analytics', hi: 'एनालिटिक्स', hinglish: 'Analytics' },
  production: { en: 'Production', hi: 'प्रोडक्शन', hinglish: 'Production' },
  qc: { en: 'Quality Check', hi: 'QC', hinglish: 'Quality Check' },
  dispatch: { en: 'Dispatch', hi: 'डिस्पैच', hinglish: 'Dispatch' },
  designers: { en: 'Designer Panel', hi: 'डिज़ाइनर', hinglish: 'Designer Panel' },
  machines: { en: 'Machines', hi: 'मशीनें', hinglish: 'Machines' },
  leads: { en: 'Leads / Sales', hi: 'लीड्स / सेल्स', hinglish: 'Leads / Sales' },
  salesAdmin: { en: 'Sales Admin (whole team)', hi: 'सेल्स एडमिन (पूरी टीम)', hinglish: 'Sales Admin (poori team)', gu: 'સેલ્સ એડમિન (આખી ટીમ)', mr: 'सेल्स अ‍ॅडमिन (संपूर्ण टीम)', mwr: 'सेल्स एडमिन (पूरी टीम)' },
  clients: { en: 'Customers', hi: 'ग्राहक', hinglish: 'Customers' },
  products: { en: 'Products', hi: 'प्रोडक्ट्स', hinglish: 'Products' },
  stock: { en: 'Stock', hi: 'स्टॉक', hinglish: 'Stock' },
  vendors: { en: 'Vendors', hi: 'वेंडर', hinglish: 'Vendors' },
  review: { en: 'Review Generator', hi: 'रिव्यू जनरेटर', hinglish: 'Review Generator' },
  invoices: { en: 'Invoices & Accounting', hi: 'इनवॉइस', hinglish: 'Invoices' },
  expenses: { en: 'Expenses & Purchases', hi: 'खर्चे', hinglish: 'Expenses' },
  parties: { en: 'Parties (Customers & Suppliers)', hi: 'पार्टी', hinglish: 'Parties' },
  purchases: { en: 'Purchases', hi: 'खरीद', hinglish: 'Purchases' },
  inventory: { en: 'Inventory', hi: 'इन्वेंटरी', hinglish: 'Inventory' },
  cashbank: { en: 'Cash & Bank', hi: 'कैश / बैंक', hinglish: 'Cash & Bank' },
  gst: { en: 'GST', hi: 'जीएसटी', hinglish: 'GST' },
  reports: { en: 'Reports', hi: 'रिपोर्ट', hinglish: 'Reports' },
  entries: { en: 'Journal Entries', hi: 'जर्नल', hinglish: 'Journal Entries' },
  tds: { en: 'TDS', hi: 'टीडीएस', hinglish: 'TDS' },
  attendance: { en: 'Team Attendance', hi: 'अटेंडेंस', hinglish: 'Team Attendance' },
  leaves: { en: 'Leave Applications', hi: 'छुट्टियां', hinglish: 'Leaves' },
  payroll: { en: 'Payroll & Salary', hi: 'पेरोल', hinglish: 'Payroll' },
  productivity: { en: 'Productivity', hi: 'प्रोडक्टिविटी', hinglish: 'Productivity' },
  tasks: { en: 'Tasks', hi: 'टास्क', hinglish: 'Tasks' },
  // "View" on these two reads differently from the rest, so the labels say what
  // they do: one is watching the team, the other is this person being tracked.
  tracking: { en: 'See team map & routes', hi: 'टीम मैप और रूट देखें', hinglish: 'Team map aur routes dekhein' },
  fieldTrack: { en: 'Share own location (field staff)', hi: 'अपनी लोकेशन शेयर करें (फील्ड स्टाफ)', hinglish: 'Apni location share karein (field staff)' },
  visits: { en: 'Shop visits', hi: 'शॉप विज़िट', hinglish: 'Shop visits' },
};
// Flat list of every feature in the catalog (used to build/save the perms object).
const CATALOG_FEATURES = PERMISSION_CATALOG.flatMap((g) => g.features);

const BUILTIN_ROLES = [
  'pending', 'staff', 'designer', 'jobsetter', 'sales', 'hr',
  'manager', 'floor_manager', 'admin', 'superadmin', 'owner',
  'accountant', 'cashier', 'inventory', 'viewer',
];

const ROLE_BADGE = {
  admin: 'badge-red', superadmin: 'badge-red', owner: 'badge-red',
  manager: 'badge-amber', floor_manager: 'badge-amber', hr: 'badge-amber',
  designer: 'badge-blue', jobsetter: 'badge-blue', sales: 'badge-blue',
  accountant: 'badge-blue', cashier: 'badge-blue', inventory: 'badge-blue', viewer: 'badge-green',
  staff: 'badge-green', pending: 'badge-amber',
};

export default function PermissionsPage() {
  const { hasRole, profile } = useAuth();
  const t = useT(S);
  const [users, setUsers] = useState({});
  const [search, setSearch] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [designations, setDesignations] = useState([]);

  const canEdit = hasRole('admin', 'superadmin', 'owner');

  useEffect(() => {
    const u = onValue(ref(db, 'mpw/users'), (snap) => setUsers(snap.val() || {}));
    return () => u();
  }, []);

  // The designation list, with how many teammates carry each. Reloaded when the
  // team changes, since assigning or renaming moves those counts.
  const loadDesignations = () => authApi.designations()
    .then((d) => setDesignations(Array.isArray(d) ? d : []))
    .catch(() => {});
  useEffect(() => { loadDesignations(); }, [users]);

  const rows = useMemo(
    () => Object.entries(users).map(([id, u]) => ({ ...u, id })),
    [users]
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((u) =>
      (u.name || '').toLowerCase().includes(q) ||
      (u.email || '').toLowerCase().includes(q) ||
      (u.role || '').toLowerCase().includes(q) ||
      (u.customRole || '').toLowerCase().includes(q)
    );
  }, [rows, search]);

  return (
    <div data-legacy-id="page-permissions">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 style={{ fontSize: 20, fontWeight: 600 }}>{t('permissionsTeam')}</h2>
          <div style={{ fontSize: 13, color: 'var(--text2)' }}>
            {filtered.length} {filtered.length === 1 ? t('user') : t('users')}
            {!canEdit && ` · ${t('readOnly')}`}
          </div>
        </div>
        {canEdit && (
          <button className="btn btn-primary btn-sm" onClick={() => setShowAdd(true)}>
            {t('addTeammate')}
          </button>
        )}
      </div>

      {canEdit && <DesignationsPanel t={t} designations={designations} reload={loadDesignations} />}

      <input
        className="input mb-4"
        placeholder={t('searchPlaceholder')}
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />

      <div className="card" style={{ padding: 0, overflow: 'auto' }}>
        {!filtered.length ? (
          <div style={{ textAlign: 'center', padding: 40, color: 'var(--text3)' }}>
            {t('noUsers')}
          </div>
        ) : (
          <table className="crm-table">
            <thead>
              <tr>
                <th>{t('thName')}</th>
                <th>{t('thEmail')}</th>
                <th>{t('thCurrentRole')}</th>
                <th>{t('thCustomRole')}</th>
                {canEdit && <th style={{ minWidth: 320 }}>{t('thChangeRole')}</th>}
                {canEdit && <th>{t('edit')}</th>}
                {canEdit && <th>{t('thAccess')}</th>}
                {canEdit && <th>{t('thHike')}</th>}
                {canEdit && <th>{t('remove')}</th>}
              </tr>
            </thead>
            <tbody>
              {filtered.map((u) => (
                <RoleRow key={u.id} u={u} canEdit={canEdit} t={t} meId={profile?.id} designations={designations} />
              ))}
            </tbody>
          </table>
        )}
      </div>

      {showAdd && <AddTeammateModal onClose={() => setShowAdd(false)} t={t} designations={designations} />}
    </div>
  );
}

// The list's own spelling of a stored designation ('' when none / not listed),
// so the dropdown shows the right option even if the stored text differs in
// case or spacing.
export function matchDesignation(value, list) {
  const k = String(value || '').replace(/\s+/g, ' ').trim().toLowerCase();
  if (!k) return '';
  const hit = (list || []).find((d) => d.name.toLowerCase() === k);
  return hit ? hit.name : '';
}

function DesignationSelect({ value, designations, onChange, t, style }) {
  return (
    <select className="input" data-testid="designation-select" style={style} value={value} onChange={(e) => onChange(e.target.value)}>
      <option value="">{t('noDesignation')}</option>
      {designations.map((d) => <option key={d.name} value={d.name}>{d.name}</option>)}
    </select>
  );
}

// Add / rename / delete the company's designations.
function DesignationsPanel({ t, designations, reload }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);

  const run = async (fn, okMsg) => {
    setBusy(true);
    try { await fn(); if (okMsg) showToast(okMsg, 'success'); await reload(); }
    catch (err) { showToast(err.response?.data?.error || t('failed'), 'error'); }
    finally { setBusy(false); }
  };
  const add = (e) => {
    e.preventDefault();
    const n = name.trim();
    if (!n) return;
    run(() => authApi.createDesignation(n), t('saved')).then(() => setName(''));
  };
  const rename = (d) => {
    const to = window.prompt(t('renamePrompt'), d.name);
    if (!to || !to.trim() || to.trim() === d.name) return;
    run(() => authApi.renameDesignation(d.name, to.trim()), t('saved'));
  };
  const remove = (d) => {
    if (!window.confirm(`${t('deleteConfirm')} ${d.count} ${t('people')}.`)) return;
    run(() => authApi.deleteDesignation(d.name), t('saved'));
  };

  return (
    <div className="card mb-4" data-testid="designations-panel">
      <div className="flex items-center justify-between" style={{ cursor: 'pointer' }} onClick={() => setOpen((o) => !o)}>
        <b>{t('designations')} ({designations.length})</b>
        <span style={{ color: 'var(--text3)' }}>{open ? '▲' : '▼'}</span>
      </div>
      {open && (
        <div style={{ marginTop: 10 }}>
          <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 8 }}>{t('designationsHint')}</div>
          <form className="flex gap-2 mb-2" onSubmit={add}>
            <input className="input" data-testid="new-designation" maxLength={40} placeholder={t('newDesignation')} value={name} onChange={(e) => setName(e.target.value)} />
            <button type="submit" className="btn btn-primary btn-sm" disabled={busy || !name.trim()}>{t('addDesignation')}</button>
          </form>
          {!designations.length ? (
            <div style={{ fontSize: 13, color: 'var(--text3)', padding: '6px 0' }}>{t('noDesignations')}</div>
          ) : designations.map((d) => (
            <div key={d.name} className="flex items-center justify-between" style={{ padding: '6px 0', borderTop: '1px solid var(--border)' }}>
              <div>
                <b>{d.name}</b>
                <span style={{ fontSize: 12, color: 'var(--text3)', marginLeft: 8 }}>
                  {d.count} {t('people')}{!d.saved ? ` · ${t('notSaved')}` : ''}
                </span>
              </div>
              <div className="flex gap-2">
                <button className="btn btn-ghost btn-xs" disabled={busy} onClick={() => rename(d)}>{t('rename')}</button>
                <button className="btn btn-ghost btn-xs" style={{ color: 'var(--red)' }} disabled={busy} onClick={() => remove(d)}>{t('remove')}</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function RoleRow({ u, canEdit, t, meId, designations = [] }) {
  const [role, setRole] = useState(u.role || 'pending');
  // The stored designation in the list's spelling. It only changes when the
  // saved value does (the list loading, a rename, someone else's save) — not
  // when the list is merely reloaded — so re-syncing on it never wipes a pick
  // the admin has made but not saved yet.
  const stored = matchDesignation(u.customRole, designations);
  const [customRole, setCustomRole] = useState(stored);
  useEffect(() => { setCustomRole(stored); }, [stored]);
  const [busy, setBusy] = useState(false);
  const [showAccess, setShowAccess] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [showHike, setShowHike] = useState(false);

  const badgeClass = ROLE_BADGE[u.role] || 'badge-blue';

  const save = async () => {
    setBusy(true);
    try {
      await authApi.setRole(u.id, { role, customRole: customRole || null });
      showToast(t('roleUpdated'), 'success');
    } catch (err) {
      showToast(err.response?.data?.error || t('failed'), 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <tr>
      <td>
        <b style={{ color: 'var(--text)' }}>{u.name || '—'}</b>
        {/* An inactive teammate is invisible everywhere else in the system —
            they drop out of Team Attendance, payroll and every teammate list —
            so the one screen that can switch it back on has to show it. */}
        {u.active === false && (
          <span className="badge badge-red" data-testid="inactive-badge" style={{ marginLeft: 6 }}
            title="Cannot sign in, and is left out of Team Attendance and other teammate lists">
            inactive
          </span>
        )}
        {/* The staff number belongs next to the name: it is how this person is
            referred to on a register or a slip, and an ID nobody can see is an
            ID nobody will use. */}
        {u.employeeId && (
          <div style={{ fontSize: 11, color: 'var(--text3)' }}>{u.employeeId}</div>
        )}
      </td>
      <td>{u.email || '—'}</td>
      <td><span className={`badge ${badgeClass}`}>{u.role || 'pending'}</span></td>
      <td>{u.customRole || '—'}</td>
      {canEdit && (
        <td>
          <div className="flex gap-2 items-center">
            <select className="input" style={{ maxWidth: 150 }} value={role} onChange={(e) => setRole(e.target.value)}>
              {BUILTIN_ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
            <DesignationSelect value={customRole} designations={designations} onChange={setCustomRole} t={t} style={{ maxWidth: 170 }} />
            <button className="btn btn-primary btn-xs" onClick={save} disabled={busy}>
              {busy ? t('saving') : t('save')}
            </button>
          </div>
        </td>
      )}
      {canEdit && (
        <td>
          <button className="btn btn-ghost btn-xs" onClick={() => setShowEdit(true)}>
            {t('edit')}
          </button>
          {showEdit && <EditUserModal u={u} t={t} meId={meId} onClose={() => setShowEdit(false)} />}
        </td>
      )}
      {canEdit && (
        <td>
          <button className="btn btn-ghost btn-xs" onClick={() => setShowAccess(true)}>
            {t('manageAccess')}
          </button>
          {showAccess && <PermissionsModal u={u} t={t} onClose={() => setShowAccess(false)} />}
        </td>
      )}
      {canEdit && (
        <td>
          {/* Pay sits with the person, not only on the payroll screen: this
              is where you already are when you decide somebody has earned a
              raise. The figure itself still lands in HR → Payroll. */}
          <button className="btn btn-ghost btn-xs" onClick={() => setShowHike(true)}>
            {t('hike')}
          </button>
          {showHike && <SalaryHikeModal user={u} onClose={() => setShowHike(false)} />}
        </td>
      )}
      {canEdit && (
        <td>
          <RemoveButton u={u} t={t} meId={meId} />
        </td>
      )}
    </tr>
  );
}

function RemoveButton({ u, t, meId }) {
  const [busy, setBusy] = useState(false);
  const isSelf = meId && String(meId) === String(u.id);
  const isOwner = u.role === 'owner';
  if (isSelf || isOwner) return <span style={{ fontSize: 11, color: 'var(--text3)' }}>—</span>;

  const remove = async () => {
    if (!window.confirm(t('confirmRemove'))) return;
    setBusy(true);
    try {
      await authApi.deleteUser(u.id);
      showToast(`${u.name || u.email} removed`, 'success');
    } catch (err) {
      showToast(err.response?.data?.error || t('failed'), 'error');
      setBusy(false);
    }
  };

  return (
    <button className="btn btn-ghost btn-xs" style={{ color: 'var(--red)' }} onClick={remove} disabled={busy}>
      {busy ? '…' : `🗑 ${t('remove')}`}
    </button>
  );
}

function PermissionsModal({ u, t, onClose }) {
  const { lang } = useLang();
  // Falls back to the key when a catalog entry has no label. Previously this
  // read dict[lang] directly, so a single feature added to PERMISSION_CATALOG
  // without a matching MODULE_LABELS entry took the WHOLE permissions dialog
  // down with a TypeError — which is exactly what happened when TDS was added.
  // A missing translation should degrade to an unpolished label, never to a
  // blank screen that blocks granting access.
  const lbl = (dict, key) => (dict && (dict[lang] ?? dict.en)) || key || '';
  const [perms, setPerms] = useState(() => {
    const p = u.permissions || {};
    const init = {};
    for (const f of CATALOG_FEATURES) {
      init[f.key] = {
        view: canViewModule(u.role, f.key, p), // allow-list: role default or explicit grant
        edit: p[`${f.key}.write`] === true,
      };
    }
    return init;
  });
  const [busy, setBusy] = useState(false);

  const adminLike = ['admin', 'superadmin', 'owner'].includes(u.role);

  const toggleView = (k) => setPerms((p) => {
    const view = !p[k].view;
    return { ...p, [k]: { view, edit: view ? p[k].edit : false } }; // can't manage what you can't view
  });
  const toggleEdit = (k) => setPerms((p) => (p[k].view ? { ...p, [k]: { ...p[k], edit: !p[k].edit } } : p));
  const setAllView = (view) => setPerms((prev) => Object.fromEntries(
    CATALOG_FEATURES.map((f) => [f.key, { view, edit: view ? prev[f.key].edit : false }])
  ));

  const save = async () => {
    setBusy(true);
    try {
      const permissions = {};
      for (const f of CATALOG_FEATURES) {
        permissions[`${f.key}.read`] = !!perms[f.key].view;
        if (f.manage) permissions[`${f.key}.write`] = !!(perms[f.key].view && perms[f.key].edit);
      }
      await authApi.setRole(u.id, { permissions });
      showToast(t('accessSaved'), 'success');
      onClose();
    } catch (err) {
      showToast(err.response?.data?.error || t('failed'), 'error');
    } finally { setBusy(false); }
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.45)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div className="card" style={{ maxWidth: 520, width: '100%', maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}>
        <h3 style={{ marginBottom: 4 }}>{t('accessFor')}</h3>
        <div style={{ fontSize: 13, color: 'var(--text2)', marginBottom: 10 }}>
          {u.name || u.email} · <span className="badge badge-blue">{u.role || 'pending'}</span>
        </div>

        {adminLike && (
          <div style={{ fontSize: 12, color: 'var(--amber)', background: 'var(--surface2)', borderRadius: 8, padding: '8px 10px', marginBottom: 10 }}>
            {u.role} already has full access — these toggles only matter for non-admin roles.
          </div>
        )}

        <div className="flex gap-2 mb-2 items-center">
          <button className="btn btn-ghost btn-xs" onClick={() => setAllView(true)}>{t('showAll')}</button>
          <button className="btn btn-ghost btn-xs" onClick={() => setAllView(false)}>{t('hideAll')}</button>
          <span style={{ marginLeft: 'auto', display: 'flex', gap: 18, fontSize: 11, color: 'var(--text3)', paddingRight: 4 }}>
            <span style={{ width: 38, textAlign: 'center' }}>{t('canViewCol')}</span>
            <span style={{ width: 44, textAlign: 'center' }}>{t('manageCol')}</span>
          </span>
        </div>

        <div style={{ overflow: 'auto', flex: 1, border: '1px solid var(--border)', borderRadius: 8 }}>
          {PERMISSION_CATALOG.map((grp) => (
            <div key={grp.group}>
              <div style={{ position: 'sticky', top: 0, background: 'var(--surface2)', padding: '6px 12px', fontSize: 11, fontWeight: 700, letterSpacing: 0.3, textTransform: 'uppercase', color: 'var(--text2)', borderTop: '1px solid var(--border)' }}>
                {lbl(GROUP_LABELS[grp.group], grp.group)}
              </div>
              {grp.features.map((f) => (
                <div key={f.key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '9px 12px', borderTop: '1px solid var(--border)' }}>
                  <span style={{ color: 'var(--text)' }}>{lbl(MODULE_LABELS[f.key], f.key)}</span>
                  <span style={{ display: 'flex', gap: 22, alignItems: 'center', paddingRight: 6 }}>
                    <input type="checkbox" title={t('canViewCol')} checked={perms[f.key].view} onChange={() => toggleView(f.key)} style={{ width: 18, height: 18 }} />
                    {f.manage ? (
                      <input type="checkbox" title={t('manageCol')} checked={perms[f.key].edit} disabled={!perms[f.key].view} onChange={() => toggleEdit(f.key)} style={{ width: 18, height: 18 }} />
                    ) : (
                      <span style={{ width: 18, textAlign: 'center', color: 'var(--text3)' }}>—</span>
                    )}
                  </span>
                </div>
              ))}
            </div>
          ))}
        </div>

        <div style={{ fontSize: 11, color: 'var(--text3)', margin: '10px 0' }}>{t('accessHint')}</div>

        <div className="flex gap-2">
          <button className="btn btn-primary flex-1" onClick={save} disabled={busy}>
            {busy ? t('saving') : t('save')}
          </button>
          <button className="btn btn-ghost" onClick={onClose}>{t('close')}</button>
        </div>
      </div>
    </div>
  );
}

function EditUserModal({ u, t, onClose, meId }) {
  const [form, setForm] = useState({
    name: u.name || '',
    email: u.email || '',
    employeeId: u.employeeId || '',
    department: u.department || '',
    active: u.active !== false,
    password: '',
  });
  const [busy, setBusy] = useState(false);
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const isSelf = meId && String(meId) === String(u.id);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      const body = {
        name: form.name.trim(),
        email: form.email.trim(),
        // Always sent, so clearing the box clears the number.
        employeeId: form.employeeId.trim(),
        department: form.department.trim() || null,
        active: form.active,
      };
      if (form.password) body.password = form.password;
      await authApi.updateUser(u.id, body);
      showToast(t('userUpdated'), 'success');
      onClose();
    } catch (err) {
      showToast(err.response?.data?.error || t('failed'), 'error');
    } finally { setBusy(false); }
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.45)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <form className="card" onSubmit={submit} style={{ maxWidth: 440, width: '100%' }}>
        <h3 style={{ marginBottom: 14 }}>{t('editUser')}</h3>

        <div className="form-group">
          <label>{t('fullName')}</label>
          <input className="input" value={form.name} onChange={(e) => set('name', e.target.value)} autoFocus />
        </div>
        <div className="form-group">
          <label>{t('emailStar')}</label>
          <input className="input" type="email" value={form.email} onChange={(e) => set('email', e.target.value)} required />
        </div>
        <div className="flex gap-2">
          <div className="form-group" style={{ flex: 1 }}>
            <label>{t('employeeId')}</label>
            <input className="input" value={form.employeeId} onChange={(e) => set('employeeId', e.target.value)} placeholder="EMP-014" />
          </div>
          <div className="form-group" style={{ flex: 1 }}>
            <label>{t('department')}</label>
            <input className="input" value={form.department} onChange={(e) => set('department', e.target.value)} />
          </div>
        </div>
        <div className="form-group">
          <label>{t('newPassword')}</label>
          <input className="input" type="text" value={form.password} onChange={(e) => set('password', e.target.value)} placeholder={t('passwordPlaceholder')} />
        </div>

        <label className="flex items-center gap-2" style={{ margin: '10px 0', cursor: isSelf ? 'not-allowed' : 'pointer' }}>
          <input type="checkbox" checked={form.active} disabled={isSelf} onChange={(e) => set('active', e.target.checked)} style={{ width: 16, height: 16 }} />
          <span>{t('active')}</span>
        </label>
        {isSelf && <div style={{ fontSize: 11, color: 'var(--amber)', marginBottom: 8 }}>{t('cannotDisableSelf')}</div>}

        <div className="flex gap-2 mt-2">
          <button type="submit" className="btn btn-primary flex-1" disabled={busy}>
            {busy ? t('saving') : t('save')}
          </button>
          <button type="button" className="btn btn-ghost" onClick={onClose}>{t('cancel')}</button>
        </div>
      </form>
    </div>
  );
}

function AddTeammateModal({ onClose, t, designations = [] }) {
  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'staff', employeeId: '', department: '', customRole: '' });
  const [busy, setBusy] = useState(false);
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const submit = async (e) => {
    e.preventDefault();
    if (!form.email.trim()) return showToast(t('emailRequired'), 'error');
    if (form.password.length < 6) return showToast(t('passwordMin'), 'error');
    setBusy(true);
    try {
      await authApi.createUser({
        email: form.email.trim(),
        password: form.password,
        name: form.name.trim(),
        role: form.role,
        employeeId: form.employeeId.trim(),
        department: form.department.trim() || null,
        customRole: form.customRole || null,
      });
      showToast(`${t('teammateCreatedPrefix')} ${form.email.trim()} ${t('teammateCreatedSuffix')}`, 'success');
      onClose();
    } catch (err) {
      showToast(err.response?.data?.error || t('createFailed'), 'error');
    } finally { setBusy(false); }
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.45)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <form className="card" onSubmit={submit} style={{ maxWidth: 440, width: '100%' }}>
        <h3 style={{ marginBottom: 14 }}>{t('addTeammate')}</h3>

        <div className="form-group">
          <label>{t('fullName')}</label>
          <input className="input" value={form.name} onChange={(e) => set('name', e.target.value)} autoFocus />
        </div>
        <div className="form-group">
          <label>{t('emailStar')}</label>
          <input className="input" type="email" placeholder={t('emailPlaceholder')} value={form.email} onChange={(e) => set('email', e.target.value)} required />
        </div>
        <div className="form-group">
          <label>{t('tempPassword')}</label>
          <input className="input" type="text" placeholder={t('passwordPlaceholder')} value={form.password} onChange={(e) => set('password', e.target.value)} required />
        </div>
        <div className="flex gap-2">
          <div className="form-group" style={{ flex: 1 }}>
            <label>{t('role')}</label>
            <select className="input" value={form.role} onChange={(e) => set('role', e.target.value)}>
              {BUILTIN_ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>
          <div className="form-group" style={{ flex: 1 }}>
            <label>{t('department')}</label>
            <input className="input" value={form.department} onChange={(e) => set('department', e.target.value)} />
          </div>
        </div>
        <div className="form-group">
          <label>{t('thCustomRole')}</label>
          <DesignationSelect value={form.customRole} designations={designations} onChange={(v) => set('customRole', v)} t={t} />
        </div>
        <div className="form-group">
          <label>{t('employeeId')}</label>
          <input className="input" value={form.employeeId} onChange={(e) => set('employeeId', e.target.value)} placeholder="EMP-014" />
          <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 4 }}>{t('employeeIdHint')}</div>
        </div>

        <div className="flex gap-2 mt-2">
          <button type="submit" className="btn btn-primary flex-1" disabled={busy}>
            {busy ? t('creating') : t('createTeammate')}
          </button>
          <button type="button" className="btn btn-ghost" onClick={onClose}>{t('cancel')}</button>
        </div>
        <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 8 }}>
          {t('shareHint')}
        </div>
      </form>
    </div>
  );
}
