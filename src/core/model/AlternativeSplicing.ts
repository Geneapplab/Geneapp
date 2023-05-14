import { Exon } from "../locus/Exon";
import { Gene } from "../locus/Gene";
import { Intron } from "../locus/Intron";
import { Isoforma } from "../locus/Isoforma";
import { Projeto } from "./Projeto";

export class AlternativeSplicing {
    evidence: string;
    gene: Gene;
    qvalue: number;
    dps: number;
    extra: {};

    constructor(evidence: string, gene: Gene, dps: number, qvalue: number, extra = {}) {
        this.evidence = evidence;
        this.gene = gene;
        this.qvalue = qvalue;
        this.dps = dps;
        this.extra = extra;
        gene.addAS(this);
    }

    getEvidence = () => this.evidence;
    hasMASER = () => this.extra['MASER']
    getGene = () => this.gene;
    share() {
        return [this.evidence, this.dps, this.qvalue]
    }

    getMRNAs(): Isoforma[][] {
        if (this.gene.getIsoformas().length < 3) {
            return [this.gene.getIsoformas()]
        }
        const ret = []
        this.gene.getIsoformas().forEach((a, i) => {
            this.gene.getIsoformas().forEach((b, j) => {
                if (j > i) {
                    ret.push([a, b])
                }
            })
        })
        return ret;
    }
}

export class AS3dranseq extends AlternativeSplicing {
    constructor(gene: Gene, raw: {}) {
        super('3DRNASeq', gene, raw['maxdeltaPS'], raw['adj.pval'], raw);
    }
    static fromShare = (gene: Gene, dt) => new AS3dranseq(gene, { 'maxdeltaPS': dt[1], 'adj.pval': dt[2] })

    getAS(projeto: Projeto) {
        var expc = this.gene.getIsoformas().map(iso => [iso.nome, projeto.getCtrl().getTPM(iso.meta['MRNA'], false)])
        var expt = this.gene.getIsoformas().map(iso => [iso.nome, projeto.getTrat().getTPM(iso.meta['MRNA'], false)])
        expc = expc.filter(t => t[1][0] > 0 && t[1][1] > 0)
        expt = expt.filter(t => t[1][0] > 0 && t[1][1] > 0)
        return expc.map(t1 => [t1[0],
        expt.filter(t2 => t1[0] !== t2[0] && t1[1][0] !== t2[1][0]).map(x => x[0])])
            .filter(x => x[1].length > 0)
    }

    getMRNAs(projeto?: Projeto): Isoforma[][] {
        const cand = super.getMRNAs();
        const ret = []

        if (cand.length < 1 || !projeto)
            return ret


        cand.forEach(([a, b]) => {
            const tpm_a_c = projeto.getCtrl().getTPM(a.meta['MRNA'], false)[0]
            const tpm_a_t = projeto.getTrat().getTPM(a.meta['MRNA'], false)[0]
            const tpm_b_c = projeto.getCtrl().getTPM(b.meta['MRNA'], false)[0]
            const tpm_b_t = projeto.getTrat().getTPM(b.meta['MRNA'], false)[0]
            if (tpm_a_c > 0 && tpm_a_t > 0 && tpm_b_c > 0 && tpm_b_t && (
                (tpm_a_c < tpm_b_c && tpm_a_t > tpm_b_t) ||
                (tpm_a_c > tpm_b_c && tpm_a_t < tpm_b_t)
            ))
                ret.push([a, b])
        })

        return ret;
    }
}

export class ASrmats extends AlternativeSplicing {
    private tipo: string;
    constructor(gene: Gene, raw: {}, tipo: string) {
        super('rMATS', gene, raw['IncLevelDifference'], raw['FDR'], raw);
        this.tipo = raw['tipo'] = tipo;
        if (!this.extra['AS_SITE_START'] && !this.extra['AS_SITE_END'])
            switch (tipo) {
                case 'RI':
                    //ri riExonStart_0base	riExonEnd
                    var ria = parseInt(raw['downstreamEE'])
                    var rib = parseInt(raw['upstreamES'])
                    this.extra['AS_SITE_START'] = Math.min(ria, rib)
                    this.extra['AS_SITE_END'] = Math.max(ria, rib)
                    break;
                case 'SE':
                    //se  exonStart_0base	exonEnd
                    var sea = parseInt(raw['exonStart_0base'])
                    var seb = parseInt(raw['exonEnd'])
                    this.extra['AS_SITE_START'] = Math.min(sea, seb)
                    this.extra['AS_SITE_END'] = Math.max(sea, seb)
                    break;
                default:
                    //a3ss   longExonStart_0base	longExonEnd	shortES	shortEE
                    //a5ss  longExonStart_0base	longExonEnd	shortES	shortEE
                    var a = parseInt(raw['longExonStart_0base'])
                    var b = parseInt(raw['longExonEnd'])
                    var c = parseInt(raw['shortES'])
                    var d = parseInt(raw['shortEE'])
                    this.extra['AS_INI_DIF'] = a !== c
                    this.extra['AS_END_DIF'] = b !== d
                    this.extra['AS_INI_DIF'] && this.extra['AS_END_DIF'] && console.warn('Evento AS duplicado ' + raw)
                    this.extra['AS_SITE_START'] = this.extra['AS_INI_DIF'] ? Math.min(a, c) : a
                    this.extra['AS_SITE_END'] = this.extra['AS_END_DIF'] ? Math.max(b, d) : b
                    this.extra['AS_PB'] = this.extra['AS_INI_DIF'] ? Math.max(a, c) : Math.min(b, d)
                    break;
            }
        this.extra['IMPACT'] = 1 + this.extra['AS_SITE_END'] - this.extra['AS_SITE_START']
    }

    coords = null;

    getASsite = (genoma?) => genoma ?
        [this.extra['AS_SITE_START'], this.extra['AS_SITE_END']] :
        (this.coords ? this.coords : (this.coords = [Math.min(this.extra['AS_SITE_START'], this.extra['AS_SITE_END']) - this.getGene().start,
        Math.max(this.extra['AS_SITE_START'], this.extra['AS_SITE_END']) - this.getGene().start]))

    getASpb = (genoma?) => this.extra['AS_PB'] - (genoma ? 0 : this.getGene().start)

    share() {
        return super.share().concat([
            this.tipo,
            this.extra['AS_SITE_START'], this.extra['AS_SITE_END'], this.extra['ID'],
            this.extra['upstreamEE'], this.extra['downstreamES'], this.extra['ptc']
        ])
    };

    static fromShare = (gene: Gene, dt) => new ASrmats(
        gene, {
        'IncLevelDifference': dt[1],
        'FDR': dt[2],
        'AS_SITE_START': dt[4],
        'AS_SITE_END': dt[5],
        'ID': dt[6], 'upstreamEE': dt[7], 'downstreamES': dt[8], ptc: dt[9]
    },
        dt[3])

    getMRNAs(): Isoforma[][] {
        const cand = super.getMRNAs();
        const ret = []

        if (cand.length < 1)
            return ret

        if (this.tipo === 'RI') {
            cand.forEach(([a, b]) => { /////                      o intron tem que estar dentro do evento
                try {
                    const validRI = (i: Intron) => this.extra['AS_SITE_START'] <= i.start && i.end <= this.extra['AS_SITE_END']
                    const isRI = (i: Intron, es: Exon[]) => es.some(e => e.start <= i.start && e.end >= i.end) && validRI(i)
                    if (a.getIntrons().some(i => isRI(i, b.getExons())) || b.getIntrons().some(i => isRI(i, a.getExons())))
                        ret.push([a, b])
                } catch {
                    console.warn('Falha ao processar', a, b)
                }
            })
        }
        if (this.tipo === 'SE') {
            cand.forEach(([a, b]) => {
                try {
                    const validSE = (e: Exon) => this.extra['AS_SITE_START'] <= e.start && e.end <= this.extra['AS_SITE_END']
                    const isSE = (e: Exon, is: Intron[]) => is.some(i => i.start <= e.start && i.end >= e.end) && validSE(e)
                    if (a.getExons().some(e => isSE(e, b.getIntrons())) || b.getExons().some(e => isSE(e, a.getIntrons())))
                        ret.push([a, b])
                } catch {
                    console.warn('Falha ao processar', a, b)
                }
            })
        }
        return ret;
    }
}