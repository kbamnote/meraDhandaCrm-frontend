/**
 * Review Generator — self-contained Google-review generator.
 * No backend: substitutes the form inputs into one of several template strings
 * and lets the user copy the result to the clipboard.
 */
import { useState } from 'react';
import { showToast } from '../components/common/toast';

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
  const [business, setBusiness] = useState('');
  const [product, setProduct] = useState('');
  const [city, setCity] = useState('');
  const [quality, setQuality] = useState('premium');
  const [occasion, setOccasion] = useState('');
  const [index, setIndex] = useState(0);
  const [review, setReview] = useState('');

  const generate = () => {
    if (!business.trim() || !product.trim()) {
      return showToast('Business and product are required', 'error');
    }
    const i = index % TEMPLATES.length;
    const text = fill(TEMPLATES[i], { business, product, city, quality, occasion });
    setReview(text);
    setIndex((prev) => (prev + 1) % TEMPLATES.length); // rotate to the next template
  };

  const copy = async () => {
    if (!review.trim()) return showToast('Generate a review first', 'error');
    try {
      await navigator.clipboard.writeText(review);
      showToast('Copied', 'success');
    } catch {
      showToast('Failed to copy', 'error');
    }
  };

  return (
    <div data-legacy-id="page-review">
      <div className="mb-4">
        <h2 style={{ fontSize: 20, fontWeight: 600 }}>⭐ Review Generator</h2>
        <div style={{ fontSize: 13, color: 'var(--text2)' }}>
          Fill in the details and generate a ready-to-post Google review.
        </div>
      </div>

      <div className="card mb-4" style={{ maxWidth: 640 }}>
        <div className="flex gap-2" style={{ flexWrap: 'wrap' }}>
          <div className="form-group" style={{ flex: 1, minWidth: 220 }}>
            <label>Business *</label>
            <input className="input" value={business} onChange={(e) => setBusiness(e.target.value)} placeholder="MrPrint World" />
          </div>
          <div className="form-group" style={{ flex: 1, minWidth: 220 }}>
            <label>Product *</label>
            <input className="input" value={product} onChange={(e) => setProduct(e.target.value)} placeholder="business cards" />
          </div>
        </div>

        <div className="flex gap-2" style={{ flexWrap: 'wrap' }}>
          <div className="form-group" style={{ flex: 1, minWidth: 220 }}>
            <label>City</label>
            <input className="input" value={city} onChange={(e) => setCity(e.target.value)} placeholder="Mumbai" />
          </div>
          <div className="form-group" style={{ flex: 1, minWidth: 220 }}>
            <label>Occasion</label>
            <input className="input" value={occasion} onChange={(e) => setOccasion(e.target.value)} placeholder="our wedding" />
          </div>
        </div>

        <div className="form-group">
          <label>Quality</label>
          <select className="input" value={quality} onChange={(e) => setQuality(e.target.value)}>
            {QUALITY_OPTIONS.map((q) => (
              <option key={q} value={q}>{q}</option>
            ))}
          </select>
        </div>

        <div className="flex gap-2 mt-2">
          <button type="button" className="btn btn-primary" onClick={generate}>
            ✨ Generate
          </button>
          <button type="button" className="btn btn-ghost" onClick={copy}>
            📋 Copy
          </button>
        </div>
      </div>

      <div className="form-group" style={{ maxWidth: 640 }}>
        <label>Generated review</label>
        <textarea
          className="input"
          rows={5}
          value={review}
          onChange={(e) => setReview(e.target.value)}
          placeholder="Your generated review will appear here…"
        />
      </div>
    </div>
  );
}
