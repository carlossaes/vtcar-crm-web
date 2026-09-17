import { moneyFields, payments, formatBRL } from '../opportunity'
import CurrencyInput from './CurrencyInput'

const control = 'w-full bg-surface2 border border-line rounded-control px-3 py-2 text-[13.5px] outline-none focus:border-brand'
export function CommercialSection({ title, children }) {
  return <section className="space-y-3"><h3 className="text-micro uppercase font-semibold text-ink3">{title}</h3>{children}</section>
}
export default function CommercialFields({ form, setForm, readOnly = false, creation = false }) {
  const change = (field, value) => setForm((old) => ({ ...old, [field]: value,
    ...(field === 'hasTradeIn' && !value ? { tradeInVehicle: '', tradeInValue: null } : {}) }))
  const input = (field, title, numeric = false) => <label key={field} className="block text-[12px] text-ink2">
    {title}
    {readOnly || (field === 'vehicleInterest' && !creation) ? <div className="text-[13.5px] text-ink mt-1">{numeric && field !== 'installmentsCount'
      ? (form[field] == null ? 'Não informado' : formatBRL(form[field])) : (form[field] ?? '') || 'Não informado'}</div>
      : numeric && field !== 'installmentsCount' ? <CurrencyInput label={title} className={control} value={form[field]} onChange={(value) => change(field, value)} />
      : <input aria-label={title} className={control} type="text" inputMode={numeric ? 'numeric' : undefined}
        min={field === 'installmentsCount' ? 1 : 0} step={field === 'installmentsCount' ? 1 : '0.01'}
        required={creation && field === 'vehicleInterest'} value={form[field] ?? ''}
        onChange={(e) => change(field, e.target.value)} />}
  </label>
  return <>
    <CommercialSection title="Veículo de interesse">{input('vehicleInterest', creation ? 'Veículo de interesse *' : 'Veículo de interesse')}</CommercialSection>
    <CommercialSection title="Formação do negócio"><div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      {moneyFields.map(([field, title]) => input(field, title, true))}
    </div></CommercialSection>
    <CommercialSection title="Troca">
      <label className="block text-[12px] text-ink2">Tem veículo na troca?
        {readOnly ? <div>{form.hasTradeIn ? 'Sim' : 'Não'}</div> : <select aria-label="Tem veículo na troca?" className={control}
          value={form.hasTradeIn === true ? 'sim' : 'nao'} onChange={(e) => change('hasTradeIn', e.target.value === 'sim')}>
          <option value="nao">Não</option><option value="sim">Sim</option>
        </select>}
      </label>
      {form.hasTradeIn && <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">{input('tradeInVehicle', 'Veículo na troca')}{input('tradeInValue', 'Valor da troca', true)}</div>}
    </CommercialSection>
    <CommercialSection title="Pagamento"><label className="block text-[12px] text-ink2">Composição do pagamento
      {readOnly ? <div>{payments[form.paymentComposition] || 'Não informado'}</div> : <select aria-label="Composição do pagamento" className={control}
        value={form.paymentComposition || ''} onChange={(e) => change('paymentComposition', e.target.value)}>
        <option value="">Não informado</option>{Object.entries(payments).map(([value, title]) => <option key={value} value={value}>{title}</option>)}
      </select>}
    </label></CommercialSection>
    <CommercialSection title="Observações">{readOnly ? <p className="whitespace-pre-wrap text-[13px]">{form.notes || 'Não informado'}</p>
      : <textarea aria-label="Observações" className={control} rows={3} value={form.notes || ''} onChange={(e) => change('notes', e.target.value)} />}</CommercialSection>
  </>
}
