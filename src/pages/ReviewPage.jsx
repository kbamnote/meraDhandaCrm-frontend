/**
 * Review Generator — self-contained Google-review generator.
 * No backend: substitutes the form inputs into one of several template strings
 * and lets the user copy the result to the clipboard.
 */
import { useState } from 'react';
import { showToast } from '../components/common/toast';
import { useT } from '../i18n/LanguageContext';

const S = {
  reviewGenerator: { en: 'Review Generator', hi: 'रिव्यू जनरेटर', hinglish: 'Review Generator', gu: 'રિવ્યૂ જનરેટર', mr: 'रिव्ह्यू जनरेटर', mwr: 'रिव्यू जनरेटर' },
  subtitle: { en: 'Fill in the details and generate a ready-to-post Google review.', hi: 'विवरण भरें और पोस्ट करने के लिए तैयार Google रिव्यू बनाएं।', hinglish: 'Details bharein aur post karne ke liye ready Google review banayein.', gu: 'વિગતો ભરો અને પોસ્ટ કરવા માટે તૈયાર Google રિવ્યૂ બનાવો.', mr: 'तपशील भरा आणि पोस्ट करण्यासाठी तयार Google रिव्ह्यू तयार करा.', mwr: 'विवरण भरो अर पोस्ट करण सारू तैयार Google रिव्यू बणावो।' },
  business: { en: 'Business *', hi: 'बिज़नेस *', hinglish: 'Business *', gu: 'બિઝનેસ *', mr: 'व्यवसाय *', mwr: 'बिज़नेस *' },
  product: { en: 'Product *', hi: 'प्रोडक्ट *', hinglish: 'Product *', gu: 'પ્રોડક્ટ *', mr: 'उत्पादन *', mwr: 'प्रोडक्ट *' },
  city: { en: 'City', hi: 'शहर', hinglish: 'City', gu: 'શહેર', mr: 'शहर', mwr: 'शहर' },
  occasion: { en: 'Occasion', hi: 'अवसर', hinglish: 'Occasion', gu: 'પ્રસંગ', mr: 'प्रसंग', mwr: 'मौको' },
  quality: { en: 'Quality', hi: 'क्वालिटी', hinglish: 'Quality', gu: 'ક્વોલિટી', mr: 'गुणवत्ता', mwr: 'क्वालिटी' },
  generate: { en: '✨ Generate', hi: '✨ जनरेट करें', hinglish: '✨ Generate', gu: '✨ જનરેટ કરો', mr: '✨ तयार करा', mwr: '✨ बणावो' },
  copy: { en: '📋 Copy', hi: '📋 कॉपी करें', hinglish: '📋 Copy', gu: '📋 કૉપિ કરો', mr: '📋 कॉपी करा', mwr: '📋 कॉपी करो' },
  generatedReview: { en: 'Generated review', hi: 'बना हुआ रिव्यू', hinglish: 'Generated review', gu: 'બનાવેલ રિવ્યૂ', mr: 'तयार केलेला रिव्ह्यू', mwr: 'बण्यो रिव्यू' },
  reviewPlaceholder: { en: 'Your generated review will appear here…', hi: 'आपका बना हुआ रिव्यू यहाँ दिखेगा…', hinglish: 'Aapka generated review yahan dikhega…', gu: 'તમારો બનાવેલ રિવ્યૂ અહીં દેખાશે…', mr: 'तुमचा तयार केलेला रिव्ह्यू इथे दिसेल…', mwr: 'थांको बण्यो रिव्यू अठे दिखसी…' },
  businessProductRequired: { en: 'Business and product are required', hi: 'बिज़नेस और प्रोडक्ट ज़रूरी हैं', hinglish: 'Business aur product zaroori hain', gu: 'બિઝનેસ અને પ્રોડક્ટ જરૂરી છે', mr: 'व्यवसाय आणि उत्पादन आवश्यक आहे', mwr: 'बिज़नेस अर प्रोडक्ट जरूरी है' },
  generateFirst: { en: 'Generate a review first', hi: 'पहले एक रिव्यू बनाएं', hinglish: 'Pehle ek review banayein', gu: 'પહેલા એક રિવ્યૂ બનાવો', mr: 'आधी एक रिव्ह्यू तयार करा', mwr: 'पैला एक रिव्यू बणावो' },
  copied: { en: 'Copied', hi: 'कॉपी हो गया', hinglish: 'Copy ho gaya', gu: 'કૉપિ થયું', mr: 'कॉपी झाले', mwr: 'कॉपी हो ग्यो' },
  failedCopy: { en: 'Failed to copy', hi: 'कॉपी नहीं हुआ', hinglish: 'Copy nahi hua', gu: 'કૉપિ કરવામાં નિષ્ફળ', mr: 'कॉपी करता आले नाही', mwr: 'कॉपी कोनी हुयो' },
};

const TEMPLATES = [
  'Had a wonderful experience with {business} in {city}! Got my {product} for {occasion} and the {quality} quality blew me away. Highly recommended!',
  'I ordered a {product} from {business} ({city}) for {occasion}. The {quality} finish and on-time delivery made the whole process effortless. Five stars!',
  'If you need a {product} in {city}, look no further than {business}. {quality} craftsmanship, friendly team, and perfect for my {occasion}. Will order again!',
  'Big thanks to {business} for the amazing {product}! Perfect for our {occasion} here in {city} and the {quality} workmanship really stood out. Truly impressed.',
  'Top-notch service from {business} in {city}. My {product} for {occasion} turned out fantastic — {quality} quality at a great price. Highly recommend to everyone!',
];

const QUALITY_OPTIONS = ['premium', 'excellent', 'superb', 'top-notch', 'outstanding'];

function fill(template, vals) {
  return template.replace(/\{(\w+)\}/g, (_, key) => {
    const v = vals[key];
    return v && String(v).trim() ? String(v).trim() : `{${key}}`;
  });
}

export default function ReviewPage() {
  const t = useT(S);
  const [business, setBusiness] = useState('');
  const [product, setProduct] = useState('');
  const [city, setCity] = useState('');
  const [quality, setQuality] = useState('premium');
  const [occasion, setOccasion] = useState('');
  const [index, setIndex] = useState(0);
  const [review, setReview] = useState('');

  const generate = () => {
    if (!business.trim() || !product.trim()) {
      return showToast(t('businessProductRequired'), 'error');
    }
    const i = index % TEMPLATES.length;
    const text = fill(TEMPLATES[i], { business, product, city, quality, occasion });
    setReview(text);
    setIndex((prev) => (prev + 1) % TEMPLATES.length); // rotate to the next template
  };

  const copy = async () => {
    if (!review.trim()) return showToast(t('generateFirst'), 'error');
    try {
      await navigator.clipboard.writeText(review);
      showToast(t('copied'), 'success');
    } catch {
      showToast(t('failedCopy'), 'error');
    }
  };

  return (
    <div data-legacy-id="page-review">
      <div className="mb-4">
        <h2 style={{ fontSize: 20, fontWeight: 600 }}>⭐ {t('reviewGenerator')}</h2>
        <div style={{ fontSize: 13, color: 'var(--text2)' }}>
          {t('subtitle')}
        </div>
      </div>

      <div className="card mb-4" style={{ maxWidth: 640 }}>
        <div className="flex gap-2" style={{ flexWrap: 'wrap' }}>
          <div className="form-group" style={{ flex: 1, minWidth: 220 }}>
            <label>{t('business')}</label>
            <input className="input" value={business} onChange={(e) => setBusiness(e.target.value)} placeholder="MeraDhanda" />
          </div>
          <div className="form-group" style={{ flex: 1, minWidth: 220 }}>
            <label>{t('product')}</label>
            <input className="input" value={product} onChange={(e) => setProduct(e.target.value)} placeholder="business cards" />
          </div>
        </div>

        <div className="flex gap-2" style={{ flexWrap: 'wrap' }}>
          <div className="form-group" style={{ flex: 1, minWidth: 220 }}>
            <label>{t('city')}</label>
            <input className="input" value={city} onChange={(e) => setCity(e.target.value)} placeholder="Mumbai" />
          </div>
          <div className="form-group" style={{ flex: 1, minWidth: 220 }}>
            <label>{t('occasion')}</label>
            <input className="input" value={occasion} onChange={(e) => setOccasion(e.target.value)} placeholder="our wedding" />
          </div>
        </div>

        <div className="form-group">
          <label>{t('quality')}</label>
          <select className="input" value={quality} onChange={(e) => setQuality(e.target.value)}>
            {QUALITY_OPTIONS.map((q) => (
              <option key={q} value={q}>{q}</option>
            ))}
          </select>
        </div>

        <div className="flex gap-2 mt-2">
          <button type="button" className="btn btn-primary" onClick={generate}>
            {t('generate')}
          </button>
          <button type="button" className="btn btn-ghost" onClick={copy}>
            {t('copy')}
          </button>
        </div>
      </div>

      <div className="form-group" style={{ maxWidth: 640 }}>
        <label>{t('generatedReview')}</label>
        <textarea
          className="input"
          rows={5}
          value={review}
          onChange={(e) => setReview(e.target.value)}
          placeholder={t('reviewPlaceholder')}
        />
      </div>
    </div>
  );
}
