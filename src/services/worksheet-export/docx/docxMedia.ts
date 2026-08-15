import { AlignmentType, ImageRun, Paragraph } from 'docx';
import { worksheetTextRun } from './docxStyle';
import {
    worksheetOptionImageKey,
    worksheetQuestionImageKey,
    type WorksheetImageAssetMap,
} from '../shared/media';

const imageRun = (data: Uint8Array, type: 'jpg' | 'png' | 'gif' | 'bmp', width: number, height: number): ImageRun =>
    new ImageRun({
        data,
        type,
        transformation: { width, height },
    });

export function renderDocxQuestionMedia(
    questionIndex: number,
    optionCount: number,
    assets?: WorksheetImageAssetMap,
): Paragraph[] {
    if (!assets) return [];
    const output: Paragraph[] = [];
    const main = assets.get(worksheetQuestionImageKey(questionIndex));
    if (main) {
        output.push(new Paragraph({
            children: [imageRun(main.bytes, main.type, 300, 200)],
            alignment: AlignmentType.CENTER,
            spacing: { before: 80, after: 100 },
        }));
    }

    for (let optionIndex = 0; optionIndex < optionCount; optionIndex += 1) {
        const asset = assets.get(worksheetOptionImageKey(questionIndex, optionIndex));
        if (!asset) continue;
        output.push(new Paragraph({
            children: [
                worksheetTextRun({
                    text: `${String.fromCharCode(65 + optionIndex)}. `,
                    bold: true,
                }),
                imageRun(asset.bytes, asset.type, 160, 110),
            ],
            alignment: AlignmentType.CENTER,
            spacing: { before: 40, after: 60 },
        }));
    }
    return output;
}
