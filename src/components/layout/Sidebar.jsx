import { NavLink } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useT } from '../../i18n/LanguageContext';
import { PERM_OF, canViewModule } from '../../config/access';

const SECTION_S = {
  Workspace: { en: 'Workspace', hi: 'वर्कस्पेस', hinglish: 'Workspace', gu: 'વર્કસ્પેસ', mr: 'वर्कस्पेस', mwr: 'वर्कस्पेस' },
  'Designers & Production': { en: 'Designers & Production', hi: 'डिज़ाइन और प्रोडक्शन', hinglish: 'Design & Production', gu: 'ડિઝાઇન અને પ્રોડક્શન', mr: 'डिझाइन व प्रोडक्शन', mwr: 'डिज़ाइन अर प्रोडक्शन' },
  'Sales & Leads': { en: 'Sales & Leads', hi: 'सेल्स और लीड्स', hinglish: 'Sales & Leads', gu: 'સેલ્સ અને લીડ્સ', mr: 'सेल्स व लीड्स', mwr: 'सेल्स अर लीड्स' },
  Accounting: { en: 'Accounting', hi: 'अकाउंटिंग', hinglish: 'Accounting', gu: 'એકાઉન્ટિંગ', mr: 'अकाउंटिंग', mwr: 'अकाउंटिंग' },
  HR: { en: 'HR', hi: 'एचआर', hinglish: 'HR', gu: 'એચઆર', mr: 'एचआर', mwr: 'एचआर' },
  Customer: { en: 'Customer', hi: 'ग्राहक', hinglish: 'Customer', gu: 'ગ્રાહક', mr: 'ग्राहक', mwr: 'ग्राहक' },
  'Admin / Settings': { en: 'Admin / Settings', hi: 'एडमिन / सेटिंग्स', hinglish: 'Admin / Settings', gu: 'એડમિન / સેટિંગ્સ', mr: 'अॅडमिन / सेटिंग्ज', mwr: 'एडमिन / सेटिंग्स' },
  'Sign out': { en: 'Sign out', hi: 'साइन आउट', hinglish: 'Sign out', gu: 'સાઇન આઉટ', mr: 'साइन आउट', mwr: 'साइन आउट' },

  // Navigation item labels — keyed by the exact English label string (emoji included).
  '🏠 Dashboard':          { en: '🏠 Dashboard',          hi: '🏠 डैशबोर्ड',           hinglish: '🏠 Dashboard',          gu: '🏠 ડેશબોર્ડ',            mr: '🏠 डॅशबोर्ड',            mwr: '🏠 डैशबोर्ड' },
  '📋 Job Cards':          { en: '📋 Job Cards',          hi: '📋 जॉब कार्ड',          hinglish: '📋 Job Cards',          gu: '📋 જોબ કાર્ડ',          mr: '📋 जॉब कार्ड',          mwr: '📋 जॉब कार्ड' },
  '✅ Tasks':              { en: '✅ Tasks',              hi: '✅ काम',               hinglish: '✅ Tasks',              gu: '✅ કાર્યો',             mr: '✅ कामे',               mwr: '✅ काम' },
  '💬 Chat':               { en: '💬 Chat',               hi: '💬 चैट',                hinglish: '💬 Chat',               gu: '💬 ચેટ',                mr: '💬 चॅट',                mwr: '💬 चैट' },
  '📊 Analytics':          { en: '📊 Analytics',          hi: '📊 एनालिटिक्स',         hinglish: '📊 Analytics',          gu: '📊 એનાલિટિક્સ',          mr: '📊 अॅनालिटिक्स',         mwr: '📊 एनालिटिक्स' },
  '🎨 Designers':          { en: '🎨 Designers',          hi: '🎨 डिज़ाइनर',           hinglish: '🎨 Designers',          gu: '🎨 ડિઝાઇનર',            mr: '🎨 डिझाइनर',            mwr: '🎨 डिज़ाइनर' },
  '🖌  My Designer Panel':  { en: '🖌  My Designer Panel',  hi: '🖌  मेरा डिज़ाइनर पैनल',  hinglish: '🖌  My Designer Panel',  gu: '🖌  મારું ડિઝાઇનર પેનલ',  mr: '🖌  माझे डिझाइनर पॅनल',   mwr: '🖌  म्हारो डिज़ाइनर पैनल' },
  '👀 Designers View':     { en: '👀 Designers View',     hi: '👀 डिज़ाइनर व्यू',        hinglish: '👀 Designers View',     gu: '👀 ડિઝાઇનર વ્યૂ',         mr: '👀 डिझाइनर व्ह्यू',        mwr: '👀 डिज़ाइनर व्यू' },
  '🛠  Job Setter':         { en: '🛠  Job Setter',         hi: '🛠  जॉब सेटर',            hinglish: '🛠  Job Setter',         gu: '🛠  જોબ સેટર',            mr: '🛠  जॉब सेटर',            mwr: '🛠  जॉब सेटर' },
  '📥 Assign Production':  { en: '📥 Assign Production',  hi: '📥 प्रोडक्शन सौंपें',     hinglish: '📥 Assign Production',  gu: '📥 પ્રોડક્શન સોંપો',      mr: '📥 प्रोडक्शन नेमा',       mwr: '📥 प्रोडक्शन सौंपो' },
  '🏭 Production':         { en: '🏭 Production',         hi: '🏭 प्रोडक्शन',           hinglish: '🏭 Production',         gu: '🏭 પ્રોડક્શન',           mr: '🏭 प्रोडक्शन',           mwr: '🏭 प्रोडक्शन' },
  '📋 Prod Steps':         { en: '📋 Prod Steps',         hi: '📋 प्रोडक्शन स्टेप्स',    hinglish: '📋 Prod Steps',         gu: '📋 પ્રોડક્શન સ્ટેપ્સ',    mr: '📋 प्रोडक्शन स्टेप्स',    mwr: '📋 प्रोडक्शन स्टेप्स' },
  '🔍 QC':                 { en: '🔍 QC',                 hi: '🔍 QC',                 hinglish: '🔍 QC',                 gu: '🔍 QC',                 mr: '🔍 QC',                 mwr: '🔍 QC' },
  '🚚 Dispatch':           { en: '🚚 Dispatch',           hi: '🚚 डिस्पैच',             hinglish: '🚚 Dispatch',           gu: '🚚 ડિસ્પેચ',             mr: '🚚 डिस्पॅच',             mwr: '🚚 डिस्पैच' },
  '⚙️  Machines':          { en: '⚙️  Machines',          hi: '⚙️  मशीनें',             hinglish: '⚙️  Machines',          gu: '⚙️  મશીનો',              mr: '⚙️  मशीन',               mwr: '⚙️  मशीनां' },
  '🕐 Machine History':    { en: '🕐 Machine History',    hi: '🕐 मशीन हिस्ट्री',        hinglish: '🕐 Machine History',    gu: '🕐 મશીન હિસ્ટ્રી',        mr: '🕐 मशीन हिस्ट्री',        mwr: '🕐 मशीन हिस्ट्री' },
  '📞 Leads CRM':          { en: '📞 Leads CRM',          hi: '📞 लीड्स CRM',           hinglish: '📞 Leads CRM',          gu: '📞 લીડ્સ CRM',           mr: '📞 लीड्स CRM',           mwr: '📞 लीड्स CRM' },
  '💼 Sales Panel':        { en: '💼 Sales Panel',        hi: '💼 सेल्स पैनल',          hinglish: '💼 Sales Panel',        gu: '💼 સેલ્સ પેનલ',          mr: '💼 सेल्स पॅनल',          mwr: '💼 सेल्स पैनल' },
  '👔 Sales Admin':        { en: '👔 Sales Admin',        hi: '👔 सेल्स एडमिन',         hinglish: '👔 Sales Admin',        gu: '👔 સેલ્સ એડમિન',         mr: '👔 सेल्स अॅडमिन',         mwr: '👔 सेल्स एडमिन' },
  '❓ Enquiry':            { en: '❓ Enquiry',            hi: '❓ पूछताछ',              hinglish: '❓ Enquiry',            gu: '❓ પૂછપરછ',              mr: '❓ चौकशी',               mwr: '❓ पूछताछ' },
  '📦 Sample DM':          { en: '📦 Sample DM',          hi: '📦 सैंपल DM',            hinglish: '📦 Sample DM',          gu: '📦 સેમ્પલ DM',           mr: '📦 सॅंपल DM',            mwr: '📦 सैंपल DM' },
  '📑 Bulk Orders':        { en: '📑 Bulk Orders',        hi: '📑 बल्क ऑर्डर',          hinglish: '📑 Bulk Orders',        gu: '📑 બલ્ક ઓર્ડર',          mr: '📑 बल्क ऑर्डर',          mwr: '📑 बल्क ऑर्डर' },
  '🛍  Products':          { en: '🛍  Products',          hi: '🛍  प्रोडक्ट्स',          hinglish: '🛍  Products',          gu: '🛍  પ્રોડક્ટ્સ',          mr: '🛍  प्रोडक्ट्स',          mwr: '🛍  प्रोडक्ट्स' },
  '📦 Stock':              { en: '📦 Stock',              hi: '📦 स्टॉक',               hinglish: '📦 Stock',              gu: '📦 સ્ટોક',               mr: '📦 स्टॉक',               mwr: '📦 स्टॉक' },
  '🏪 Vendors':            { en: '🏪 Vendors',            hi: '🏪 वेंडर',               hinglish: '🏪 Vendors',            gu: '🏪 વેન્ડર',              mr: '🏪 व्हेंडर',             mwr: '🏪 वेंडर' },
  '💰 Accounting':         { en: '💰 Accounting',         hi: '💰 अकाउंटिंग',           hinglish: '💰 Accounting',         gu: '💰 એકાઉન્ટિંગ',          mr: '💰 अकाउंटिंग',           mwr: '💰 अकाउंटिंग' },
  '🧾 Invoice':            { en: '🧾 Invoice',            hi: '🧾 इनवॉइस',              hinglish: '🧾 Invoice',            gu: '🧾 ઇન્વોઇસ',             mr: '🧾 इनव्हॉइस',            mwr: '🧾 इनवॉइस' },
  '🧾 Expenses':           { en: '🧾 Expenses',           hi: '🧾 खर्च',                hinglish: '🧾 Expenses',           gu: '🧾 ખર્ચ',                mr: '🧾 खर्च',                mwr: '🧾 खर्च' },
  '📦 Purchase Orders':    { en: '📦 Purchase Orders',    hi: '📦 परचेज़ ऑर्डर',         hinglish: '📦 Purchase Orders',    gu: '📦 પરચેઝ ઓર્ડર',         mr: '📦 परचेस ऑर्डर',         mwr: '📦 परचेज़ ऑर्डर' },
  '📒 Client Ledger':      { en: '📒 Client Ledger',      hi: '📒 क्लाइंट लेजर',         hinglish: '📒 Client Ledger',      gu: '📒 ક્લાયન્ટ લેજર',        mr: '📒 क्लायंट लेजर',         mwr: '📒 क्लाइंट लेजर' },
  '👥 HR Dashboard':       { en: '👥 HR Dashboard',       hi: '👥 HR डैशबोर्ड',          hinglish: '👥 HR Dashboard',       gu: '👥 HR ડેશબોર્ડ',          mr: '👥 HR डॅशबोर्ड',          mwr: '👥 HR डैशबोर्ड' },
  '🧑‍💼 Staff':            { en: '🧑‍💼 Staff',            hi: '🧑‍💼 स्टाफ',             hinglish: '🧑‍💼 Staff',            gu: '🧑‍💼 સ્ટાફ',             mr: '🧑‍💼 कर्मचारी',          mwr: '🧑‍💼 स्टाफ' },
  '🏖  Leaves':            { en: '🏖  Leaves',            hi: '🏖  छुट्टियां',           hinglish: '🏖  Leaves',            gu: '🏖  રજાઓ',               mr: '🏖  रजा',                mwr: '🏖  छुट्टियां' },
  '💵 Payroll':            { en: '💵 Payroll',            hi: '💵 पेरोल',               hinglish: '💵 Payroll',            gu: '💵 પેરોલ',               mr: '💵 पेरोल',               mwr: '💵 पेरोल' },
  '🕒 Team Attendance':    { en: '🕒 Team Attendance',    hi: '🕒 टीम हाज़िरी',          hinglish: '🕒 Team Attendance',    gu: '🕒 ટીમ હાજરી',            mr: '🕒 टीम हजेरी',           mwr: '🕒 टीम हाजरी' },
  '🕒 Attendance':         { en: '🕒 Attendance',         hi: '🕒 हाजिरी',              hinglish: '🕒 Attendance',         gu: '🕒 હાજરી',               mr: '🕒 हजेरी',               mwr: '🕒 हाजरी' },
  '⚡ Productivity':       { en: '⚡ Productivity',       hi: '⚡ प्रोडक्टिविटी',        hinglish: '⚡ Productivity',       gu: '⚡ પ્રોડક્ટિવિટી',        mr: '⚡ प्रोडक्टिव्हिटी',       mwr: '⚡ प्रोडक्टिविटी' },
  '🌴 My Leaves':          { en: '🌴 My Leaves',          hi: '🌴 मेरी छुट्टियां',       hinglish: '🌴 My Leaves',          gu: '🌴 મારી રજાઓ',           mr: '🌴 माझ्या रजा',          mwr: '🌴 म्हारी छुट्टियां' },
  '⏱  My Attendance':      { en: '⏱  My Attendance',      hi: '⏱  मेरी हाजिरी',          hinglish: '⏱  My Attendance',      gu: '⏱  મારી હાજરી',          mr: '⏱  माझी हजेरी',          mwr: '⏱  म्हारी हाजरी' },
  '💸 My Salary':          { en: '💸 My Salary',          hi: '💸 मेरी सैलरी',          hinglish: '💸 My Salary',          gu: '💸 મારો પગાર',           mr: '💸 माझा पगार',           mwr: '💸 म्हारी सैलरी' },
  '🏢 Depts':              { en: '🏢 Depts',              hi: '🏢 विभाग',               hinglish: '🏢 Depts',              gu: '🏢 વિભાગો',              mr: '🏢 विभाग',               mwr: '🏢 विभाग' },
  '🗂  Manage Depts':      { en: '🗂  Manage Depts',      hi: '🗂  विभाग प्रबंधन',       hinglish: '🗂  Manage Depts',      gu: '🗂  વિભાગ સંચાલન',        mr: '🗂  विभाग व्यवस्थापन',     mwr: '🗂  विभाग प्रबंधन' },
  '🙂 Customer':           { en: '🙂 Customer',           hi: '🙂 ग्राहक',              hinglish: '🙂 Customer',           gu: '🙂 ગ્રાહક',              mr: '🙂 ग्राहक',              mwr: '🙂 ग्राहक' },
  '⭐ Review':             { en: '⭐ Review',             hi: '⭐ रिव्यू',              hinglish: '⭐ Review',             gu: '⭐ રિવ્યૂ',              mr: '⭐ रिव्ह्यू',            mwr: '⭐ रिव्यू' },
  '📄 Job Detail':         { en: '📄 Job Detail',         hi: '📄 जॉब डिटेल',           hinglish: '📄 Job Detail',         gu: '📄 જોબ ડિટેલ',           mr: '📄 जॉब डिटेल',           mwr: '📄 जॉब डिटेल' },
  '🔐 Permissions':        { en: '🔐 Permissions',        hi: '🔐 अनुमतियां',           hinglish: '🔐 Permissions',        gu: '🔐 પરવાનગીઓ',            mr: '🔐 परवानग्या',           mwr: '🔐 अनुमतियां' },
  '🌳 Hierarchy':          { en: '🌳 Hierarchy',          hi: '🌳 पदानुक्रम',           hinglish: '🌳 Hierarchy',          gu: '🌳 પદક્રમ',              mr: '🌳 पदानुक्रम',           mwr: '🌳 पदानुक्रम' },
  '📣 Broadcast':          { en: '📣 Broadcast',          hi: '📣 ब्रॉडकास्ट',          hinglish: '📣 Broadcast',          gu: '📣 બ્રોડકાસ્ટ',          mr: '📣 ब्रॉडकास्ट',          mwr: '📣 ब्रॉडकास्ट' },
  '👑 Super Admin':        { en: '👑 Super Admin',        hi: '👑 सुपर एडमिन',          hinglish: '👑 Super Admin',        gu: '👑 સુપર એડમિન',          mr: '👑 सुपर अॅडमिन',         mwr: '👑 सुपर एडमिन' },
  '⚙️  Company':           { en: '⚙️  Company',           hi: '⚙️  कंपनी',              hinglish: '⚙️  Company',           gu: '⚙️  કંપની',              mr: '⚙️  कंपनी',              mwr: '⚙️  कंपनी' },
  '💳 Billing & Plan':     { en: '💳 Billing & Plan',     hi: '💳 बिलिंग और प्लान',      hinglish: '💳 Billing & Plan',     gu: '💳 બિલિંગ અને પ્લાન',     mr: '💳 बिलिंग व प्लॅन',        mwr: '💳 बिलिंग अर प्लान' },
  '👤 My Profile':         { en: '👤 My Profile',         hi: '👤 मेरी प्रोफाइल',        hinglish: '👤 My Profile',         gu: '👤 મારી પ્રોફાઇલ',        mr: '👤 माझी प्रोफाइल',        mwr: '👤 म्हारी प्रोफाइल' },
  '👑 Platform Console':   { en: '👑 Platform Console',   hi: '👑 प्लेटफॉर्म कंसोल',     hinglish: '👑 Platform Console',   gu: '👑 પ્લેટફોર્મ કન્સોલ',    mr: '👑 प्लॅटफॉर्म कन्सोल',     mwr: '👑 प्लेटफॉर्म कंसोल' },

  // Super Admin section (Module 14)
  'Super Admin': { en: 'Super Admin', hi: 'सुपर एडमिन', hinglish: 'Super Admin', gu: 'સુપર એડમિન', mr: 'सुपर अॅडमिन', mwr: 'सुपर एडमिन' },
  'Platform': { en: 'Platform', hi: 'प्लेटफ़ॉर्म', hinglish: 'Platform', gu: 'પ્લેટફોર્મ', mr: 'प्लॅटफॉर्म', mwr: 'प्लेटफॉर्म' },
  '📢 Send Notification': { en: '📢 Send Notification', hi: '📢 नोटिफिकेशन भेजें', hinglish: '📢 Send Notification', gu: '📢 નોટિફિકેશન મોકલો', mr: '📢 नोटिफिकेशन पाठवा', mwr: '📢 नोटिफिकेशन भेजो' },
  '📜 Audit Log':      { en: '📜 Audit Log',      hi: '📜 ऑडिट लॉग',        hinglish: '📜 Audit Log',      gu: '📜 ઓડિટ લોગ',         mr: '📜 ऑडिट लॉग',        mwr: '📜 ऑडिट लॉग' },
  '🔑 API Keys':       { en: '🔑 API Keys',       hi: '🔑 API कीज़',         hinglish: '🔑 API Keys',       gu: '🔑 API કીઝ',          mr: '🔑 API कीज',         mwr: '🔑 API कीज़' },
  '🪝 Webhooks':       { en: '🪝 Webhooks',       hi: '🪝 वेबहुक्स',          hinglish: '🪝 Webhooks',       gu: '🪝 વેબહૂક્સ',          mr: '🪝 वेबहूक्स',         mwr: '🪝 वेबहुक्स' },
  '🌐 Custom Domain':  { en: '🌐 Custom Domain',  hi: '🌐 कस्टम डोमेन',       hinglish: '🌐 Custom Domain',  gu: '🌐 કસ્ટમ ડોમેન',       mr: '🌐 कस्टम डोमेन',      mwr: '🌐 कस्टम डोमेन' },
  '🎁 Referrals':      { en: '🎁 Referrals',      hi: '🎁 रेफरल',            hinglish: '🎁 Referrals',      gu: '🎁 રેફરલ',            mr: '🎁 रेफरल',           mwr: '🎁 रेफरल' },
};

/**
 * Sidebar — every entry corresponds to one legacy `<div class="page" id="page-*">`.
 * The route paths use the same suffix as the original IDs so a developer
 * porting code from the HTML can grep by ID and find the React route.
 */
const SECTIONS = [
  {
    title: 'Workspace',
    items: [
      { to: '/admin',         label: '🏠 Dashboard',          legacy: 'page-admin' },
      { to: '/job-cards',     label: '📋 Job Cards',          legacy: 'page-job-cards' },
      { to: '/tasks',         label: '✅ Tasks',              legacy: 'page-tasks' },
      { to: '/chat',          label: '💬 Chat',               legacy: 'page-chat' },
      { to: '/analytics',     label: '📊 Analytics',          legacy: 'page-analytics' },
    ],
  },
  {
    title: 'Designers & Production',
    items: [
      { to: '/designers',         label: '🎨 Designers',         legacy: 'page-designers' },
      { to: '/designer',          label: '🖌  My Designer Panel', legacy: 'page-designer' },
      { to: '/designers-view',    label: '👀 Designers View',    legacy: 'page-designers-view' },
      { to: '/jobsetter',         label: '🛠  Job Setter',        legacy: 'page-jobsetter' },
      { to: '/assign-prod',       label: '📥 Assign Production', legacy: 'page-assign-prod' },
      { to: '/production',        label: '🏭 Production',        legacy: 'page-production' },
      { to: '/prod-steps',        label: '📋 Prod Steps',        legacy: 'page-prod-steps' },
      { to: '/qc',                label: '🔍 QC',                legacy: 'page-qc' },
      { to: '/dispatch',          label: '🚚 Dispatch',          legacy: 'page-dispatch' },
      { to: '/machines',          label: '⚙️  Machines',          legacy: 'page-machines' },
      { to: '/machine-history',   label: '🕐 Machine History',   legacy: 'page-machine-history' },
    ],
  },
  {
    title: 'Sales & Leads',
    items: [
      { to: '/leads-crm',     label: '📞 Leads CRM',         legacy: 'page-leads-crm' },
      { to: '/sales-panel',   label: '💼 Sales Panel',       legacy: 'page-sales-panel' },
      { to: '/sales-admin',   label: '👔 Sales Admin',       legacy: 'page-sales-admin' },
      { to: '/enquiry',       label: '❓ Enquiry',           legacy: 'page-enquiry' },
      { to: '/sample-dm',     label: '📦 Sample DM',         legacy: 'page-sample-dm' },
      { to: '/bulk-orders',   label: '📑 Bulk Orders',       legacy: 'page-bulk-orders' },
      { to: '/products',      label: '🛍  Products',         legacy: 'page-products' },
      { to: '/stock',         label: '📦 Stock',             legacy: 'page-stock' },
      { to: '/vendors',       label: '🏪 Vendors',           legacy: 'page-vendors' },
    ],
  },
  {
    title: 'Accounting',
    items: [
      { to: '/accounting',     label: '💰 Accounting',        legacy: 'page-accounting' },
      { to: '/invoice-view',   label: '🧾 Invoice',           legacy: 'page-invoice-view' },
      { to: '/expenses',       label: '🧾 Expenses',          legacy: 'page-expenses' },
      { to: '/purchase-orders', label: '📦 Purchase Orders',  legacy: 'page-purchase-orders' },
      { to: '/client-ledger',  label: '📒 Client Ledger',     legacy: 'page-client-ledger' },
    ],
  },
  {
    title: 'HR',
    items: [
      { to: '/hr-dashboard',  label: '👥 HR Dashboard',      legacy: 'page-hr-dashboard', roles: ['admin','superadmin','owner','hr'] },
      { to: '/hr-staff',      label: '🧑‍💼 Staff',             legacy: 'page-hr-staff',     roles: ['admin','superadmin','owner','hr'] },
      { to: '/hr-leaves',     label: '🏖  Leaves',           legacy: 'page-hr-leaves',    roles: ['admin','superadmin','owner','hr'] },
      { to: '/hr-payroll',    label: '💵 Payroll',           legacy: 'page-hr-payroll',   roles: ['admin','superadmin','owner','hr'] },
      { to: '/hr-attendance', label: '🕒 Team Attendance',   legacy: 'page-hr-attendance', roles: ['admin','superadmin','owner','hr'] },
      { to: '/attendance',    label: '🕒 Attendance',        legacy: 'page-attendance' },
      { to: '/productivity',  label: '⚡ Productivity',      legacy: 'page-productivity', roles: ['admin','superadmin','owner','hr','manager'] },
      { to: '/my-leaves',     label: '🌴 My Leaves',         legacy: 'page-my-leaves' },
      { to: '/my-attendance', label: '⏱  My Attendance',     legacy: 'page-my-attendance' },
      { to: '/my-salary',     label: '💸 My Salary',         legacy: 'page-my-salary' },
      { to: '/dept-mgmt',     label: '🏢 Depts',             legacy: 'page-dept-mgmt',    roles: ['admin','superadmin','owner','hr','manager'] },
      { to: '/manage-depts',  label: '🗂  Manage Depts',     legacy: 'page-manage-depts', roles: ['admin','superadmin','owner','hr','manager'] },
    ],
  },
  {
    title: 'Customer',
    items: [
      { to: '/cust-dashboard', label: '🙂 Customer',          legacy: 'page-cust-dashboard' },
      { to: '/review',         label: '⭐ Review',            legacy: 'page-review' },
      { to: '/job-detail',     label: '📄 Job Detail',        legacy: 'page-job-detail' },
    ],
  },
  {
    title: 'Admin / Settings',
    items: [
      { to: '/permissions',      label: '🔐 Permissions',     legacy: 'page-permissions', roles: ['admin','superadmin','owner'] },
      { to: '/hierarchy',        label: '🌳 Hierarchy',       legacy: 'page-hierarchy',   roles: ['admin','superadmin','owner'] },
      { to: '/broadcast',        label: '📣 Broadcast',       legacy: 'page-broadcast',   roles: ['admin','superadmin','owner'] },
      { to: '/superadmin',       label: '👑 Super Admin',     legacy: 'page-superadmin',  roles: ['superadmin'] },
      { to: '/company-settings', label: '⚙️  Company',         legacy: 'page-company-settings', roles: ['admin','superadmin','owner'] },
      { to: '/billing',          label: '💳 Billing & Plan',  legacy: 'page-billing',     roles: ['admin','superadmin','owner'] },
      { to: '/profile',          label: '👤 My Profile',      legacy: 'page-profile' },
      { to: '/platform',         label: '👑 Platform Console', legacy: 'page-platform',   platform: true },
    ],
  },
  {
    title: 'Super Admin',
    items: [
      { to: '/audit-log',     label: '📜 Audit Log',     legacy: 'page-audit-log',     roles: ['admin','superadmin','owner'] },
      { to: '/api-keys',      label: '🔑 API Keys',      legacy: 'page-api-keys',      roles: ['admin','superadmin','owner'] },
      { to: '/webhooks',      label: '🪝 Webhooks',      legacy: 'page-webhooks',      roles: ['admin','superadmin','owner'] },
      { to: '/custom-domain', label: '🌐 Custom Domain', legacy: 'page-custom-domain', roles: ['admin','superadmin','owner'] },
      { to: '/referrals',     label: '🎁 Referrals',     legacy: 'page-referrals',     roles: ['admin','superadmin','owner'] },
    ],
  },
];

// Platform super-admins (MeraDhanda staff) operate the PLATFORM, not a CRM — so
// they get a focused nav (companies console + profile), never the tenant
// operational sections (Job Cards / Tasks / Designer / HR / …).
const PLATFORM_SECTIONS = [
  {
    title: 'Platform',
    items: [
      { to: '/platform', label: '👑 Platform Console', legacy: 'page-platform' },
      { to: '/platform-broadcast', label: '📢 Send Notification', legacy: 'page-platform-broadcast' },
      { to: '/profile',  label: '👤 My Profile',       legacy: 'page-profile' },
    ],
  },
];

// Which onboarding module each sidebar route belongs to. Routes not listed here
// are "core" and always shown. A module is hidden only if the tenant explicitly
// turned it off during onboarding (settings.modules[key] === false).
const MODULE_OF = {
  '/designers': 'designers', '/designer': 'designers', '/designers-view': 'designers', '/jobsetter': 'designers',
  '/machines': 'machines', '/machine-history': 'machines',
  '/qc': 'qcDispatch', '/dispatch': 'qcDispatch',
  '/hr-dashboard': 'hr', '/hr-staff': 'hr', '/hr-leaves': 'hr', '/hr-payroll': 'hr',
  '/hr-attendance': 'hr', '/attendance': 'hr', '/productivity': 'hr', '/my-leaves': 'hr', '/my-attendance': 'hr',
  '/my-salary': 'hr', '/dept-mgmt': 'hr', '/manage-depts': 'hr',
  '/bulk-orders': 'bulk', '/enquiry': 'bulk', '/sample-dm': 'bulk',
};

export default function Sidebar({ open, onClose }) {
  const { profile, tenant, isPlatformAdmin, signOut } = useAuth();
  const t = useT(SECTION_S);
  const role = profile?.role;
  const custom = profile?.customRole;
  const modules = tenant?.settings?.modules || null;
  const perms = profile?.permissions || {};
  const isAdmin = ['admin', 'superadmin', 'owner'].includes(role);

  const canSee = (item) => {
    if (item.platform) return isPlatformAdmin;
    // Hide a link only if its module was explicitly disabled in onboarding.
    const mod = MODULE_OF[item.to];
    if (mod && modules && modules[mod] === false) return false;
    // Per-user section visibility (allow-list): gated sections show only if the
    // role default or an explicit grant allows them. Admins/owners see everything.
    if (!isAdmin) {
      const pmod = PERM_OF[item.to];
      if (pmod && !canViewModule(role, pmod, perms)) return false;
    }
    if (!item.roles) return true;
    return item.roles.includes(role) || item.roles.includes(custom);
  };

  const onTrial = tenant && tenant.plan === 'trial';

  return (
    <>
      <aside className={`sidebar ${open ? 'open' : ''}`}>
        <div className="sidebar-logo" style={{ display: 'block' }}>
          <div style={{ background: '#fff', borderRadius: 8, padding: '6px 10px', display: 'inline-block', marginBottom: 8 }}>
            <img src={tenant?.settings?.branding?.logo || '/logo.png'} alt="Logo" style={{ height: 24, display: 'block', maxWidth: 120, objectFit: 'contain' }} />
          </div>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--sidebar-text-active)' }}>
            {tenant?.name || 'MeraDhanda CRM'}
          </div>
          {onTrial && (
            <a href="/billing" style={{ display: 'block', marginTop: 6, fontSize: 11, fontWeight: 500,
              color: tenant.expired ? '#FCA5A5' : '#FCD34D' }}>
              {tenant.expired ? '⛔ Trial ended — upgrade' : `⏳ Trial · ${tenant.trialDaysLeft ?? 0} days left`}
            </a>
          )}
        </div>
        <nav>
          {(isPlatformAdmin ? PLATFORM_SECTIONS : SECTIONS).map(sec => (
            <div key={sec.title}>
              <div className="sidebar-section-title">{t(sec.title)}</div>
              {sec.items.filter(canSee).map(item => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  onClick={onClose}
                  data-legacy={item.legacy}
                  className={({ isActive }) => isActive ? 'active' : ''}
                >
                  {t(item.label)}
                </NavLink>
              ))}
            </div>
          ))}
        </nav>
        <div style={{ marginTop: 'auto', padding: 16, borderTop: '1px solid rgba(255,255,255,.06)' }}>
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,.55)', marginBottom: 8 }}>
            {profile?.name || profile?.email || 'Loading…'} <br/>
            <span style={{ fontSize: 10, opacity: .7 }}>{role || 'no role'} {custom ? `• ${custom}` : ''}</span>
          </div>
          <button className="btn btn-ghost btn-sm w-full" onClick={signOut} style={{ color: 'rgba(255,255,255,.85)' }}>
            {t('Sign out')}
          </button>
        </div>
      </aside>
      <div className={`sidebar-overlay ${open ? 'open' : ''}`} onClick={onClose} />
    </>
  );
}
