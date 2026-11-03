import { useEffect, useRef, useState } from 'react';
import { sendOtp, verifyOtp } from '../api.js';
import BottomSheet from './BottomSheet.jsx';

const MOBILE_RE = /^[6-9]\d{9}$/;
const digits = (v, max) => v.replace(/\D/g, '').slice(0, max);

// BottomSheet har baar band hone par content hata deta hai, isliye form ka state apne aap reset ho jata hai.
export default function LoginSheet({ open, onClose, onSuccess }) {
  return (
    <BottomSheet open={open} onClose={onClose} title="Login to continue">
      <LoginForm onSuccess={onSuccess} />
    </BottomSheet>
  );
}

function LoginForm({ onSuccess }) {
  const [step, setStep] = useState('mobile'); // 'mobile' -> 'otp'
  const [mobile, setMobile] = useState('');
  const [otp, setOtp] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [wait, setWait] = useState(0); // resend ka countdown (seconds)
  const verifying = useRef(false);

  useEffect(() => {
    if (wait <= 0) return undefined;
    const t = setTimeout(() => setWait((w) => w - 1), 1000);
    return () => clearTimeout(t);
  }, [wait]);

  const send = async (e) => {
    e?.preventDefault();
    if (busy) return;
    if (!MOBILE_RE.test(mobile)) {
      setError('Enter a valid 10 digit mobile number.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const res = await sendOtp(mobile);
      setStep('otp');
      setOtp('');
      setWait(res.retry_after || 60);
    } catch (err) {
      // OTP abhi abhi ja chuka hai: seedha OTP wale step par le jao
      if (err.status === 429 && err.data?.retry_after) {
        setStep('otp');
        setOtp('');
        setWait(err.data.retry_after);
      }
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const verify = async (code) => {
    if (verifying.current) return;
    verifying.current = true;
    setBusy(true);
    setError('');
    try {
      const res = await verifyOtp(mobile, code);
      onSuccess(res.token, res.customer);
    } catch (err) {
      setError(err.message);
      setOtp('');
    } finally {
      verifying.current = false;
      setBusy(false);
    }
  };

  const onOtpChange = (e) => {
    const v = digits(e.target.value, 6);
    setOtp(v);
    if (v.length === 6) verify(v); // 6 digit poore hote hi apne aap verify
  };

  if (step === 'mobile') {
    return (
      <form onSubmit={send} className="mt-1">
        <p className="text-sm text-slate-600">Enter your mobile number. We will send you an OTP.</p>

        <div className="mt-4 flex h-12 items-center overflow-hidden rounded-xl border-2 border-slate-200 focus-within:border-brand">
          <span className="grid h-full place-items-center border-r border-slate-200 bg-slate-50 px-3 text-base font-bold text-slate-600">
            +91
          </span>
          <input
            type="tel"
            inputMode="numeric"
            autoComplete="tel-national"
            autoFocus
            value={mobile}
            onChange={(e) => setMobile(digits(e.target.value, 10))}
            placeholder="10 digit mobile number"
            aria-label="Mobile number"
            className="h-full min-w-0 flex-1 bg-transparent px-3 text-base outline-none placeholder:text-slate-400"
          />
        </div>

        {error && <p className="mt-2 text-sm font-semibold text-tomato">{error}</p>}

        <button
          type="submit"
          disabled={busy || mobile.length !== 10}
          className="mt-4 h-12 w-full rounded-xl bg-brand font-extrabold text-white active:bg-brand-dark disabled:bg-slate-300"
        >
          {busy ? 'Sending OTP...' : 'Send OTP'}
        </button>
      </form>
    );
  }

  return (
    <div className="mt-1">
      <p className="text-sm text-slate-600">
        Enter the 6 digit OTP sent to <span className="font-bold text-ink">+91 {mobile}</span>
      </p>

      <input
        type="text"
        inputMode="numeric"
        autoComplete="one-time-code"
        autoFocus
        maxLength={6}
        value={otp}
        onChange={onOtpChange}
        disabled={busy}
        placeholder="------"
        aria-label="OTP"
        className="mt-4 h-14 w-full rounded-xl border-2 border-slate-200 bg-transparent text-center text-2xl font-extrabold tracking-[0.5em] outline-none placeholder:text-slate-300 focus:border-brand"
      />

      {error && <p className="mt-2 text-sm font-semibold text-tomato">{error}</p>}
      {busy && <p className="mt-2 text-sm text-slate-500">Checking...</p>}

      <div className="mt-4 flex items-center justify-between text-sm">
        <button
          type="button"
          onClick={() => {
            setStep('mobile');
            setError('');
            setOtp('');
          }}
          className="h-11 font-bold text-brand-dark underline"
        >
          Change number
        </button>
        {wait > 0 ? (
          <span className="text-slate-500">Resend in {wait}s</span>
        ) : (
          <button type="button" onClick={send} disabled={busy} className="h-11 font-bold text-brand-dark underline">
            Resend OTP
          </button>
        )}
      </div>
    </div>
  );
}