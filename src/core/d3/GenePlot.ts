import * as d3 from "d3";
import { CDS, Exon, Gene, Intron, Isoforma, Locus, Projeto } from "../model";
import { AbstractCartesianPlot } from "./AbstractPlot";
import { Canvas } from "./Canvas";
import { ViewBox } from "./Size";

export class GenePlot extends AbstractCartesianPlot {

    plotExon(exon: Exon, viewBox: ViewBox, R) {
        const [X, W, Y, _, H] = this.getPoints(exon, R, viewBox).concat([15]);
        const rct = this.rect(X, Y, W, H, 'blue', 8)
            .attr('stroke', 'black')
            .attr('stroke-width', '2px')
        rct.append("title").text(exon.nome)
        this.fillGradient(rct, 'green')
    }

    plotCDS(cds: Locus, viewBox: ViewBox, R) {
        const [X, W, Y, _, H] = this.getPoints(cds, R, viewBox).concat([11]);
        const rct = this.rect(X, Y + 1, W, H + 2, 'blue', 5)
            .attr('stroke', 'black')
            .attr('stroke-width', '2px')
        rct.append("title").text(cds.nome)
        this.fillGradient(rct, 'blue')
    }

    plotDomain(locus: Locus, viewBox: ViewBox, R) {
        const [X, W, Y, _, H] = this.getPoints(locus, R, viewBox).concat([11]);
        const rct = this.rect(X, Y + 1, W, H + 2, 'blue', 5)
        rct.append("title").text(locus.nome)
        this.fillPattern(rct, 'cyan', 2)
    }

    plotIntron(intron: Intron, viewBox: ViewBox, R) {
        const [X, W, Y, _, H] = this.getPoints(intron, R, viewBox).concat([15]);
        this.wave(X, Y + 3, W, 'black', 4).append("title").text(intron.nome)
    }

    plotIsoform(isoform: Isoforma, viewBox: ViewBox, R) {
        const [X, W, Y, H] = this.getPoints(isoform, R, viewBox);
        this.text(X, Y + 5, isoform.nome, { vc: 1, fs: '.6rem', b: 1 })

        isoform.getIntrons().forEach(i => this.plotIntron(i, viewBox.addPaddingY(20), R))
        isoform.getExons().forEach(e => this.plotExon(e, viewBox.addPaddingY(20), R))
        isoform.hasCDS() && isoform.getCDS().getLoci().forEach(cds => this.plotCDS(cds, viewBox.addPaddingY(20), R))
        isoform.getAnots().forEach(a => a.toLoci(isoform).forEach(l => this.plotDomain(l, viewBox.addPaddingY(20), R)))
    }

    getX0 = (l: Locus, R) => R(l.strand ? l.start : l.end)
    getX1 = (l: Locus, R) => R(l.strand ? l.end : l.start)
    getW = (l: Locus, R) => this.getX1(l, R) - this.getX0(l, R)
    getPoints = (l: Locus, R, v: ViewBox) => [this.getX0(l, R), this.getW(l, R), v.getBoxY0(), v.getBoxSize().height]

    plot(gene: Gene, projeto?: Projeto): Canvas {
        if (!gene) return

        const viewBox = this.viewBox.addPadding(5, 5).center();
        const GH = 40
        const boxGene = viewBox.withHeight(GH)

        const R = d3
            .scaleLinear()
            .domain([gene.start, gene.end])
            .range(gene.strand ?
                [boxGene.getBoxX0(), boxGene.getBoxX1()] :
                [boxGene.getBoxX1(), boxGene.getBoxX0()]);

        this.svg
            .append('g')
            .attr("transform", `translate(0,${boxGene.getBoxY0() + GH * .4})`)
            .call(d3.axisTop(R))
            .selectAll("text")
            .attr('font-size', '.5rem');

        if (gene.isAS()) {
            gene.getCanonic().getSites().forEach(s => {
                const rct = this.rect(this.getX0(s, R), boxGene.getBoxY1(), this.getW(s, R), viewBox.getBoxSize().height - 40)
                this.fillPattern(rct, 'gray')
            })
        }

        const gnY = boxGene.getBoxY0() + GH * .7
        const dm = 16
        const ro = dm / 2
        const ttpm = (t) => t[1] > 0 ? `(${t[1]}) TPM μ ${t[0]}` : ` ${gene.meta['NID']} ?`
        if (projeto) {
            const tpmC = projeto.getCtrl().getTPMgene(gene.meta['NID'])
            const tpmT = projeto.getTrat().getTPMgene(gene.meta['NID'])

            this.circ(5 + boxGene.getBoxX0(), gnY + ro / 2, ro, 'white').attr('stroke', 'black')
            this.circ(5 + boxGene.getBoxX0(), gnY + ro / 2, ro, projeto.getCtrl().cor).attr('opacity', .5).append("title").text(ttpm(tpmC))

            this.circ(8 + boxGene.getBoxX0() + dm, gnY + ro / 2, ro, 'white').attr('stroke', 'black')
            this.circ(8 + boxGene.getBoxX0() + dm, gnY + ro / 2, ro, projeto.getTrat().cor).attr('opacity', .5).append("title").text(ttpm(tpmT))
        }
        this.text(boxGene.getBoxX0() + dm * 2 + 4, gnY + ro / 2, gene.nome, { vc: 1, fs: '.8rem', b: 1 })


        const regua = this.line({ v: 0, y1: boxGene.getBoxY0() + 10, y2: viewBox.getBoxY1() + 5, c: "gray", x1: null, x2: null, h: null });
        const ctext = this.text(0, boxGene.getBoxY1() + 5, '').attr('font-size', '.5rem')
        const RM = 2
        const RW = boxGene.getBoxSize().width + RM * 2
        const pbPpx = gene.size / RW
        this.rect(boxGene.getBoxX0() - RM, boxGene.getBoxY0() + GH * .3, RW, 8)
            .on('mousemove', coord => {
                regua &&
                    regua.attr("x1", coord.offsetX) &&
                    regua.attr("x2", coord.offsetX) &&
                    ctext.attr("transform",
                        `translate(${coord.offsetX + (coord.offsetX > boxGene.getBoxSize().width / 2 ? -5 : 5)},0)`)
                        .text(Math.floor((gene.strand ? gene.start : gene.end) + ((coord.offsetX - 3 * RM) * pbPpx * (gene.strand ? 1 : -1))).toLocaleString())
                        .style('text-anchor', coord.offsetX > boxGene.getBoxSize().width / 2 ? 'end' : 'start')
            })
        const boxes = viewBox.addPaddingY(GH + 10).splitY(gene.getIsoformas().length)
        gene.getIsoformas().forEach((iso, i) => this.plotIsoform(iso, boxes[i], R))

        return
    }

    invalidate(gene: Gene) {
        this.reset()
        this.plot(gene);
    }

}