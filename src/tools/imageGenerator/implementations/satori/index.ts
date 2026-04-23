import satori from 'satori';
import { Resvg } from '@resvg/resvg-js';
import fs from 'node:fs/promises';
import type { IImageGenerator } from '../../interface.js';

export class SatoriImageGenerator implements IImageGenerator {
  private fontPath = '/System/Library/Fonts/Supplemental/Arial.ttf';

  async generate(position: number): Promise<Buffer> {
    const fontData = await fs.readFile(this.fontPath);

    const svg = await satori(
      {
        type: 'div',
        props: {
          style: {
            height: '100%',
            width: '100%',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: '#16161d', // Eigengrau
            color: '#ffcc00', // Mustard of Authority
            padding: '40px',
            fontFamily: 'Arial',
          },
          children: [
            {
              type: 'div',
              props: {
                style: {
                  fontSize: '48px',
                  fontWeight: 'bold',
                  marginBottom: '20px',
                },
                children: 'The Waiting Game',
              },
            },
            {
              type: 'div',
              props: {
                style: {
                  fontSize: '96px',
                  fontWeight: 'bold',
                  marginBottom: '20px',
                },
                children: `#${(position + 1).toLocaleString()}`,
              },
            },
            {
              type: 'div',
              props: {
                style: {
                  fontSize: '32px',
                  color: '#cc99ff', // Indifferent Lavender
                  fontStyle: 'italic',
                },
                children: 'The contest notes your presence.',
              },
            },
          ],
        },
      },
      {
        width: 1200,
        height: 630,
        fonts: [
          {
            name: 'Arial',
            data: fontData,
            weight: 700,
            style: 'normal',
          },
        ],
      }
    );

    const resvg = new Resvg(svg, {
      fitTo: {
        mode: 'width',
        value: 1200,
      },
    });

    return resvg.render().asPng();
  }
}
