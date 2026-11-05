"""Rome OSP 2025 form: structured requirements, conditional attachments and frozen drafts."""
import copy
import math
import uuid
from datetime import date, datetime, timezone

SCHEMA = 'roma-osp-eventi-2025-v1'
SOURCE = 'https://www.comune.roma.it/web-resources/cms/documents/OSP_eventi_manifestazioni_commercio_2025.pdf'
RISK = 'https://www.comune.roma.it/web-resources/cms/documents/Modulo_tabella_valutazione_rischi_manifestazioni_pubbliche_2025.pdf'
EMERGENCY = 'https://www.comune.roma.it/web-resources/cms/documents/modulo2_piano_emergenza_manifestazione.pdf'

def condition(rule, values):
    if not rule: return True
    if 'tutte' in rule: return all(condition(r, values) for r in rule['tutte'])
    if 'almeno_una' in rule: return any(condition(r, values) for r in rule['almeno_una'])
    value = values.get(rule.get('campo'))
    expected = rule.get('valore')
    if rule.get('op') == 'ne': return value != expected
    if rule.get('op') == 'in': return value in expected
    return value == expected

def eq(field, value): return {'campo': field, 'valore': value}
def both(*rules): return {'tutte': list(rules)}
def either(*rules): return {'almeno_una': list(rules)}
ORG = {'campo': 'tipo_soggetto', 'op': 'in', 'valore': ['Azienda', 'Associazione', 'Ente']}
FULL = {'campo': 'elaborato_semplificato', 'op': 'ne', 'valore': True}
SPECIAL = either(FULL, eq('tende_luci_insegne', True))

def make_template():
    fields, docs = [], []
    def f(id, label, tipo='text', section='Evento', scope='comune', required=True, **kw):
        fields.append(dict(id=id, label=label, tipo=tipo, sezione=section, scope=scope, required=required, opzioni=[], **kw))
    def d(id, label, condizione=None, required=True, help_text='', fonte_url=None, photo=False):
        docs.append(dict(id=id, label=label, required=required, condizione=condizione, help_text=help_text, fonte_url=fonte_url,
                         accept='.jpg,.jpeg,.png,.pdf' if photo else '.pdf,.p7m', scope='area'))
    for id, label, cond in [('nome','Nome e cognome',None), ('codice_fiscale','Codice fiscale del richiedente',None),
                            ('email','Email',None), ('pec','PEC per le comunicazioni',None), ('telefono','Telefono',None),
                            ('ragione_sociale','Denominazione ente / società',ORG), ('partita_iva','Partita IVA',eq('tipo_soggetto','Azienda'))]:
        f(id,label,section='Richiedente',profilo=True,condizione=cond)
    f('tipo_soggetto','Tipo di richiedente','select',section='Richiedente',profilo=True)
    fields[-1]['opzioni'] = ['Privato','Azienda','Associazione','Ente']
    for id,label,tipo in [('nascita_comune','Comune / Stato di nascita','text'),('nascita_provincia','Provincia di nascita (EE se estero)','text'),('nascita_data','Data di nascita','date'),
                           ('residenza_comune','Comune di residenza','text'),('residenza_indirizzo','Indirizzo e numero civico di residenza','text'),('residenza_cap','CAP di residenza','text'),('domicilio_fiscale','Domicilio fiscale','text')]:
        f(id,label,tipo,section='Dati mancanti del richiedente')
    for id,label in [('ente_sede','Sede legale: Comune, indirizzo, civico e CAP'),('ente_codice_fiscale','Codice fiscale dell’ente / società'),('ente_pec','PEC dell’ente / società')]:
        f(id,label,section='Ente / società',condizione=ORG)
    f('legale_rappresentante','Dichiaro di agire come legale rappresentante','checkbox',section='Ente / società',condizione=ORG)
    f('permesso_necessario','Richiedente extra UE: occorre il permesso di soggiorno','checkbox',section='Richiedente',required=False)
    f('documento_estremi','Documento di identità: tipo, numero, rilascio ed ente emittente',section='Richiedente')
    f('evento_nome','Titolo della manifestazione')
    f('evento_descrizione','Descrizione, finalità e programma','textarea')
    f('persone_previste','Numero di persone previste','number',min=1,intero=True)
    f('natura_evento','Natura dell’attività','select')
    fields[-1]['opzioni'] = ['Culturale / ricreativa', 'Sportiva', 'Commerciale', 'Mista']
    f('allestimenti','Descrizione degli allestimenti e delle strutture','textarea')
    f('pubblico_spettacolo','L’evento prevede pubblico spettacolo (artt. 68 e 80 TULPS)','checkbox',required=False)
    f('deroga_acustica','Occorre autorizzazione acustica / deroga rumore','checkbox',required=False)
    f('diritti_regime','Diritti di istruttoria','select',section='Pagamenti e bolli')
    fields[-1]['opzioni']=['Versamento','Esenzione richiesta']
    for id,label,tipo in [('diritti_importo','Importo diritti versati (€)','number'),('diritti_riferimento','Riferimento del versamento','text'),('diritti_data','Data del versamento','date')]:
        f(id,label,tipo,section='Pagamenti e bolli',condizione=eq('diritti_regime','Versamento'))
    f('diritti_esenzione','Motivo e riferimento dell’esenzione dai diritti','textarea',section='Pagamenti e bolli',condizione=eq('diritti_regime','Esenzione richiesta'))
    f('bollo_regime','Imposta di bollo','select',section='Pagamenti e bolli',help_text='Il modello prevede una marca da 16 € per l’istanza e una per il rilascio, salvo esenzione. Verifica modalità e importi con l’ufficio.')
    fields[-1]['opzioni']=['Bollo dovuto','Esenzione richiesta']
    f('bollo_istanza','Identificativo e data della marca per l’istanza',section='Pagamenti e bolli',condizione=eq('bollo_regime','Bollo dovuto'))
    f('bollo_rilascio','Identificativo marca per il rilascio (se già disponibile)',section='Pagamenti e bolli',required=False,condizione=eq('bollo_regime','Bollo dovuto'))
    f('bollo_esenzione','Motivo e norma dell’esenzione dal bollo','textarea',section='Pagamenti e bolli',condizione=eq('bollo_regime','Esenzione richiesta'))
    for id,label in [('veridicita','Dichiaro la veridicità dei dati ai sensi del DPR 445/2000'),('regolamento','Dichiaro di conoscere e rispettare il regolamento del canone unico (DAC 21/2021 e successive modifiche)'),('impegni_pagamento','Mi impegno al pagamento di canone e cauzione stabiliti dall’ufficio'),('autorizzazioni','Mi impegno a richiedere le autorizzazioni di pubblico spettacolo e acustiche, ove necessarie'),('privacy_letta','Ho letto l’informativa sul trattamento dei dati personali (GDPR)')]:
        f(id,label,'checkbox',section='Dichiarazioni')
    f('ufficio_destinatario','Municipio / ufficio competente da confermare',scope='area',section='Occupazione',help_text='Per eventi su più Municipi o di interesse cittadino verifica il coordinamento centrale con Roma Capitale.')
    for id,label,tipo in [('ubicazione','Ubicazione e numero civico','text'),('data_inizio','Inizio occupazione (incluso allestimento)','date'),('data_fine','Fine occupazione (incluso disallestimento)','date'),('superficie_totale','Superficie complessiva richiesta (m²)','number'),('superficie_culturale','Quota per attività culturali / sportive (m²)','number'),('superficie_commerciale','Quota per attività commerciali (m²)','number')]:
        f(id,label,tipo,scope='area',section='Occupazione',**({'min': 0 if id != 'superficie_totale' else 0.01} if tipo=='number' else {}))
    f('estensione_lineare','Estensione lineare, se applicabile (m)','number',scope='area',section='Occupazione',required=False,min=0)
    f('alberature','Alberature presenti nell’area (indicare anche se assenti)','textarea',scope='area',section='Occupazione',condizione=eq('pubblico_spettacolo',True))
    for id,label,help_text in [('area_verde','L’occupazione interessa un’area verde',''),('elaborato_semplificato','Occupazione occasionale, di dimensioni limitate e durata massima di 3 giorni','Se applicabile puoi usare un disegno semplificato. L’ufficio verifica l’ammissibilità; nessuna soglia automatica di superficie.'),('tende_luci_insegne','Sono presenti tende, faretti o insegne','Richiede prospetti, dettagli e fotografie anche con elaborato semplificato.'),('sottoservizi','Sono previsti interventi sui sottoservizi','')]:
        f(id,label,'checkbox',scope='area',section='Documentazione tecnica',required=False,help_text=help_text)
    f('canone_esente','Occupazione esente dal canone, con titolo documentato','checkbox',scope='area',section='Documentazione tecnica',required=False,help_text='Allega il titolo che dimostra l’esenzione. Il pagamento simulato nell’app non sostituisce le ricevute ufficiali.')
    d('istanza_firmata','Istanza OSP compilata e firmata',fonte_url=SOURCE)
    d('doc_identita','Documento di identità del richiedente')
    d('permesso_soggiorno','Permesso di soggiorno',eq('permesso_necessario',True))
    d('ricevuta_diritti','Ricevuta dei diritti di istruttoria',eq('diritti_regime','Versamento'))
    d('esenzione_diritti','Documentazione esenzione diritti',eq('diritti_regime','Esenzione richiesta'))
    d('assolvimento_bollo','Attestazione assolvimento imposta di bollo',eq('bollo_regime','Bollo dovuto'))
    d('esenzione_bollo','Documentazione esenzione bollo',eq('bollo_regime','Esenzione richiesta'))
    d('stralcio','Stralcio planimetrico in scala 1:500',FULL)
    d('planimetria','Planimetria in scala 1:200',FULL,help_text='Stato dei luoghi, arredi, accessibilità e fermate del trasporto pubblico.')
    d('prospetti','Piante e prospetti (scala non superiore a 1:100)',SPECIAL)
    d('dettagli','Dettagli costruttivi (scala non superiore a 1:50)',SPECIAL)
    for kind,label in [('ambiente','ambiente'),('dettaglio','dettaglio')]:
        for n in range(1,4): d(f'foto_{kind}_{n}',f'Foto {label} {n} di 3',SPECIAL,help_text='Il modello richiede fotografie di almeno 18 × 24 cm.',photo=True)
    d('relazione_tecnica','Relazione tecnica',FULL)
    d('disegno_semplificato','Disegno illustrativo semplificato',eq('elaborato_semplificato',True))
    d('cronoprogramma','Cronoprogramma interventi sui sottoservizi',eq('sottoservizi',True))
    d('polizza_rct','Polizza RCT/O per attività culturali / ricreative in area verde',both(ORG,eq('area_verde',True),{'campo':'natura_evento','op':'in','valore':['Culturale / ricreativa','Mista']}))
    d('contratto_rifiuti','Contratto di gestione rifiuti con operatore autorizzato',{'campo':'canone_esente','op':'ne','valore':True})
    d('esenzione_canone','Titolo comprovante l’esenzione dal canone',eq('canone_esente',True))
    d('valutazione_rischi','Tabella di valutazione dei rischi firmata',fonte_url=RISK)
    d('piano_emergenza','Piano di emergenza ed evacuazione firmato dal tecnico abilitato',fonte_url=EMERGENCY)
    d('autorizzazione_spettacolo','Autorizzazione pubblico spettacolo (se già disponibile)',eq('pubblico_spettacolo',True),required=False)
    d('autorizzazione_acustica','Autorizzazione acustica (se già disponibile)',eq('deroga_acustica',True),required=False)
    return dict(nome='Roma · OSP eventi e manifestazioni',tipo='OSP',schema_key=SCHEMA,campi=fields,documenti_richiesti=docs,fonte_url=SOURCE)

async def template_for_space(db, space):
    tpl = await db.form_templates.find_one({'id':space.get('form_template_id')},{'_id':0}) if space.get('form_template_id') else None
    return tpl or await db.form_templates.find_one({'comune_id':space['comune_id'],'schema_key':SCHEMA},{'_id':0}) or await db.form_templates.find_one({'comune_id':space['comune_id'],'tipo':'OSP'},{'_id':0}) or await db.form_templates.find_one({'comune_id':space['comune_id']},{'_id':0}) or {'campi':[],'documenti_richiesti':[]}

def prepare(practice, template, space, user, people=None):
    if template.get('schema_key') != SCHEMA: return
    practice['form_template_snapshot'] = copy.deepcopy(template)
    values = practice['dati_form']
    values.update({k:user[k] for k in ['nome','email','tipo_soggetto','codice_fiscale','pec','telefono','ragione_sociale','partita_iva'] if user.get(k)})
    values.setdefault('tipo_soggetto','Privato')
    values.update(ubicazione=space.get('indirizzo',''),data_inizio=practice['data_inizio'],data_fine=practice['data_fine'],evento_nome=practice.get('campagna_nome',''),superficie_totale=space.get('superficie_mq',''),area_verde=space.get('slug') in ['lago-eur','villa-ada'])
    if people: values['persone_previste']=people
    # The booked period is authoritative; edits must go through the period endpoint.
    for field in practice['form_template_snapshot']['campi']:
        if field['id'] in ('data_inizio','data_fine'): field['read_only'] = True

def merge_values(practice, incoming):
    values = {**practice.get('dati_form',{}), **incoming}
    if practice.get('form_template_snapshot',{}).get('schema_key') == SCHEMA:
        for f in practice['form_template_snapshot']['campi']:
            if f.get('read_only'): values[f['id']] = practice.get('dati_form',{}).get(f['id'])
            if f.get('profilo') and practice.get('richiedente',{}).get(f['id']): values[f['id']] = practice['richiedente'][f['id']]
    return values

def errors(practice):
    tpl=practice.get('form_template_snapshot',{})
    if tpl.get('schema_key') != SCHEMA: return []
    v=practice.get('dati_form',{}); result=[]
    for f in tpl['campi']:
        if not condition(f.get('condizione'),v): continue
        value=v.get(f['id']); empty=value is None or (isinstance(value,str) and not value.strip())
        if f.get('required') and (empty or (f['tipo']=='checkbox' and value is not True)): result.append(f['label']); continue
        if empty: continue
        if f['tipo']=='number':
            try:
                n=float(value)
                if not math.isfinite(n) or ('min' in f and n < f['min']) or (f.get('intero') and not n.is_integer()): raise ValueError()
            except (ValueError,TypeError): result.append(f['label']+' non valido')
        if f['tipo']=='select' and value not in f['opzioni']: result.append(f['label']+' non valido')
        if f['tipo']=='date':
            try: date.fromisoformat(value)
            except (TypeError,ValueError): result.append(f['label']+' non valida')
    try:
        if float(v.get('superficie_culturale',0))+float(v.get('superficie_commerciale',0)) > float(v.get('superficie_totale',0)): result.append('Le quote di superficie superano il totale')
        start=date.fromisoformat(v.get('data_inizio','')); end=date.fromisoformat(v.get('data_fine',''))
        if start != date.fromisoformat(practice['data_inizio']) or end != date.fromisoformat(practice['data_fine']): result.append('Le date devono corrispondere al periodo prenotato')
        if end < start or (v.get('elaborato_semplificato') is True and (end-start).days > 2): result.append('Elaborato semplificato ammesso solo fino a 3 giorni')
    except (ValueError,TypeError): pass  # Individual field errors above.
    uploaded={d.get('tipo') for d in practice.get('documenti',[])}
    result.extend('Allegato: '+d['label'] for d in tpl['documenti_richiesti'] if d.get('required') and condition(d.get('condizione'),v) and d['id'] not in uploaded)
    return result

async def install(db):
    if await db.migrations.find_one({'_id':SCHEMA}):
        # Existing attachment sources are managed by the municipality; preserve edits.
        return
    city=await db.comuni.find_one({'nome':'Roma'})
    if not city: return
    spaces=await db.spazi.find({'comune_id':city['id'],'tipologia':'Progetto Speciale','archiviato':{'$ne':True}},{'_id':0}).to_list(1000)
    now=datetime.now(timezone.utc).isoformat()
    tpl={**make_template(),'id':str(uuid.uuid5(uuid.NAMESPACE_URL,SCHEMA)),'comune_id':city['id'],'updated_at':now}
    await db.seed_backups.update_one({'_id':SCHEMA},{'$setOnInsert':{'bindings':[{'id':s['id'],'form_template_id':s.get('form_template_id')} for s in spaces],'created_at':now}},upsert=True)
    await db.form_templates.update_one({'id':tpl['id']},{'$setOnInsert':tpl},upsert=True)
    if spaces: await db.spazi.update_many({'id':{'$in':[s['id'] for s in spaces]}},{'$set':{'form_template_id':tpl['id']}})
    drafts=await db.pratiche.find({'comune_id':city['id'],'tipo':'OSP','stato':'BOZZA','spazio_id':{'$in':[s['id'] for s in spaces]}},{'_id':0}).to_list(10000)
    await db.seed_backups.update_one({'_id':SCHEMA},{'$set':{'bozze':drafts}})
    space_map={s['id']:s for s in spaces}
    for p in drafts:
        user=await db.users.find_one({'id':p['user_id']},{'_id':0}) or p.get('richiedente',{})
        campaign=await db.campagne.find_one({'id':p.get('campagna_id')},{'_id':0}) or {}
        prepare(p,tpl,space_map[p['spazio_id']],user,(campaign.get('brief') or {}).get('persone_previste'))
        await db.pratiche.update_one({'id':p['id'],'stato':'BOZZA'},{'$set':{'dati_form':p['dati_form'],'form_template_snapshot':p['form_template_snapshot']}})
    await db.migrations.insert_one({'_id':SCHEMA,'completed_at':now})
