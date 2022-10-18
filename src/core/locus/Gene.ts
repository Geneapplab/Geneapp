import { AlternativeSplicing } from "../model/AlternativeSplicing";
import { Cromossomo } from "../model/Cromossomo";
import { DifferentialExpression } from "../model/DifferentialExpression";
import { Isoforma } from "./Isoforma";
import { Locus } from "./Locus";

export class Gene extends Locus {
    private isoformas: Array<Isoforma> = new Array<Isoforma>();
    private bed = {};
    private as_events = new Array<AlternativeSplicing>();
    private dexp: DifferentialExpression = null;
    private anots;


    getAS = () => this.as_events;

    addAS(as: AlternativeSplicing) {
        this.as_events.push(as)
    }

    setDE(de: DifferentialExpression) {
        this.dexp = de;
    }

    addIsoforma(isoforma: Isoforma) {
        this.isoformas.push(isoforma);
    }

    getIsoformaByID(id: string) {
        return this.isoformas.filter(i => i.meta.ID === id)[0];
    }

    hasIsoforma = (id: string) => this.isoformas.some(i => i.meta.ID === id);

    update(chr: Cromossomo): void {
        this.isoformas.forEach(i => i.update(this));
    }

    getIsoformas = () => this.isoformas;

    setBED(raw: string[]) {
        if (!this.bed[raw[0]])
            this.bed[raw[0]] = [[parseInt(raw[2]), parseInt(raw[3]), parseInt(raw[4])]]
        else
            this.bed[raw[0]].push([parseInt(raw[2]), parseInt(raw[3]), parseInt(raw[4])])
    }

    getBED = (site?: number[]) => site ? Object.fromEntries(Object.entries(this.bed).map(x => [x[0],
    x[1].filter(b => b[0] >= site[0] && b[1] <= site[1])
    ])) : this.bed;

    getAnots = (t?) => this.anots || (this.anots = [... new Set(this.isoformas.map(i => i.getAnotsAcession(t)).reduce((p, c) => p.concat(c), []))].filter(x => x !== '?'))

}