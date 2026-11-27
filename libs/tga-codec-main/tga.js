(function (global, factory) {
    typeof exports === 'object' && typeof module !== 'undefined' ? factory(exports) :
    typeof define === 'function' && define.amd ? define(['exports'], factory) :
    (global = typeof globalThis !== 'undefined' ? globalThis : global || self, factory(global.tgaCodec = {}));
}(this, (function (exports) { 'use strict';

    function assert(condition, message) {
        if (!condition) {
            throw new Error(message);
        }
    }
    
    function assertOffset(data, offset) {
        assert(data instanceof Uint8Array, 'Data must be a Uint8Array');
        assert(offset >= 0 && offset < data.length, 'Offset is out of bounds');
    }

    const imageTypes = {
        NO_IMAGE_DATA: 0,
        COLOR_MAPPED: 1,
        TRUE_COLOR: 2,
        GRAYSCALE: 3,
        RLE_COLOR_MAPPED: 9,
        RLE_TRUE_COLOR: 10,
        RLE_GRAYSCALE: 11,
    };

    const bitsPerPixel = {
        BPP8: 8,
        BPP15: 15,
        BPP16: 16,
        BPP24: 24,
        BPP32: 32,
    };

    class ByteStreamReader {
        constructor(bytes) {
            assertOffset(bytes, 0);
            this.bytes = bytes;
            this.offset = 0;
        }
        readUint8() {
            assertOffset(this.bytes, this.offset);
            return this.bytes[this.offset++];
        }
        readUint16() {
            const byte1 = this.readUint8();
            const byte2 = this.readUint8();
            return (byte2 << 8) | byte1;
        }
        readBytes(count) {
            assertOffset(this.bytes, this.offset + count - 1);
            const sub = this.bytes.subarray(this.offset, this.offset + count);
            this.offset += count;
            return sub;
        }
    }

    function decodeTga(data) {
        const reader = new ByteStreamReader(data);
        
        // Header
        const idLength = reader.readUint8();
        const colorMapType = reader.readUint8();
        const imageType = reader.readUint8();
        
        // Color Map Spec
        const colorMapOrigin = reader.readUint16();
        const colorMapLength = reader.readUint16();
        const colorMapDepth = reader.readUint8();

        // Image Spec
        const xOrigin = reader.readUint16();
        const yOrigin = reader.readUint16();
        const width = reader.readUint16();
        const height = reader.readUint16();
        const bpp = reader.readUint8();
        const imageDescriptor = reader.readUint8();

        // Image ID
        if (idLength > 0) {
            reader.readBytes(idLength);
        }

        // Color Map
        let colorMap = null;
        if (colorMapType === 1) {
            const colorMapSize = colorMapLength * (colorMapDepth >> 3);
            colorMap = reader.readBytes(colorMapSize);
        }

        // Image Data
        const pixelCount = width * height;
        const imageData = new Uint8ClampedArray(pixelCount * 4);
        const bytesPerPixel = bpp >> 3;

        const isRle = imageType >= 8;

        if (isRle) {
            let pixelIndex = 0;
            while (pixelIndex < pixelCount) {
                const packet = reader.readUint8();
                const isRlePacket = (packet & 0x80) !== 0;
                const count = (packet & 0x7F) + 1;
                
                if (isRlePacket) {
                    const color = reader.readBytes(bytesPerPixel);
                    for (let i = 0; i < count; i++) {
                        setPixel(imageData, pixelIndex++, color, bpp, colorMap, colorMapDepth);
                    }
                } else {
                    for (let i = 0; i < count; i++) {
                        const color = reader.readBytes(bytesPerPixel);
                        setPixel(imageData, pixelIndex++, color, bpp, colorMap, colorMapDepth);
                    }
                }
            }
        } else {
            for (let i = 0; i < pixelCount; i++) {
                const color = reader.readBytes(bytesPerPixel);
                setPixel(imageData, i, color, bpp, colorMap, colorMapDepth);
            }
        }
        
        return { width, height, data: imageData };
    }

    function setPixel(imageData, index, colorData, bpp, colorMap, colorMapDepth) {
        const offset = index * 4;
        let r = 0, g = 0, b = 0, a = 255;
        
        switch (bpp) {
            case 8:
                if (colorMap) {
                    const mapIndex = colorData[0] * (colorMapDepth >> 3);
                    const mapColor = colorMap.subarray(mapIndex, mapIndex + (colorMapDepth >> 3));
                    // Recursive call to handle color map entry
                    const tempImageData = new Uint8ClampedArray(4);
                    setPixel(tempImageData, 0, mapColor, colorMapDepth, null, 0);
                    r = tempImageData[0];
                    g = tempImageData[1];
                    b = tempImageData[2];
                    a = tempImageData[3];
                } else {
                    r = g = b = colorData[0];
                }
                break;
            case 16:
                const val16 = (colorData[1] << 8) | colorData[0];
                r = (val16 & 0x7C00) >> 10;
                g = (val16 & 0x03E0) >> 5;
                b = (val16 & 0x001F);
                r = (r << 3) | (r >> 2);
                g = (g << 3) | (g >> 2);
                b = (b << 3) | (b >> 2);
                a = (val16 & 0x8000) ? 255 : 0;
                break;
            case 24:
                b = colorData[0];
                g = colorData[1];
                r = colorData[2];
                break;
            case 32:
                b = colorData[0];
                g = colorData[1];
                r = colorData[2];
                a = colorData[3];
                break;
        }

        imageData[offset] = r;
        imageData[offset + 1] = g;
        imageData[offset + 2] = b;
        imageData[offset + 3] = a;
    }

    exports.decodeTga = decodeTga;

})));