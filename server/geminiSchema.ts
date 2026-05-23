import { Schema, SchemaType } from '@google/generative-ai';

export function buildReceiptListSchema(categoryNames: string[]): Schema {
  const categoryProperty: Schema = (categoryNames.length
    ? {
        type: SchemaType.STRING,
        enum: categoryNames,
        description: 'Primaere Kategorie fuer die Ausgabe',
      }
    : {
        type: SchemaType.STRING,
        description: 'Primaere Kategorie fuer die Ausgabe',
      }) as Schema;

  return {
    type: SchemaType.OBJECT,
    properties: {
      receipts: {
        type: SchemaType.ARRAY,
        items: {
          type: SchemaType.OBJECT,
          properties: {
            merchant: { 
              type: SchemaType.STRING, 
              description: 'Name of the store or provider' 
            },
            date: { 
              type: SchemaType.STRING, 
              description: 'Receipt purchase date normalized as YYYY-MM-DD. Use an empty string only if no receipt date is visible.' 
            },
            total: { 
              type: SchemaType.NUMBER, 
              description: 'Total amount paid' 
            },
            currency: { 
              type: SchemaType.STRING, 
              description: 'Currency code (e.g. USD, EUR)' 
            },
            category: categoryProperty,
            items: {
              type: SchemaType.ARRAY,
              items: {
                type: SchemaType.OBJECT,
                properties: {
                  name: { type: SchemaType.STRING },
                  price: { type: SchemaType.NUMBER },
                  quantity: { type: SchemaType.NUMBER },
                  imageUrl: { 
                    type: SchemaType.STRING, 
                    description: 'URL to the item image if found in the source text' 
                  },
                },
              },
            },
            tags: { 
              type: SchemaType.ARRAY, 
              items: { type: SchemaType.STRING },
              description: 'Optional list of tags to persist with the receipt, such as source labels or order identifiers.'
            },
            box_2d: { 
              type: SchemaType.ARRAY, 
              items: { type: SchemaType.NUMBER },
              description: 'Bounding box of the specific receipt in the format [ymin, xmin, ymax, xmax] normalized to 0-1000'
            },
          },
          required: ['merchant', 'date', 'total', 'category'],
        },
      },
    },
    required: ['receipts'],
  };
}