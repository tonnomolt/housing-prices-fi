import { PostalCodeGeometrySource, type PostalCodeFeature } from '../source/PostalCodeGeometrySource.ts';
import { createLogger } from '../utils/Logger.ts';

const logger = createLogger('MunicipalityResolver');

/**
 * Resolves municipality names → postal codes using Tilastokeskus WFS data.
 *
 * Flow: municipality name → municipality code → postal codes
 * All resolved from a single WFS fetch (cached per instance).
 */
export class MunicipalityResolver {
    private features: PostalCodeFeature[] | null = null;
    private geometrySource: PostalCodeGeometrySource;

    constructor(geometrySource?: PostalCodeGeometrySource) {
        this.geometrySource = geometrySource ?? new PostalCodeGeometrySource();
    }

    /**
     * Fetch and cache all WFS features (called once per run).
     */
    private async ensureFeatures(): Promise<PostalCodeFeature[]> {
        if (!this.features) {
            logger.info('Fetching WFS data for municipality resolution...');
            this.features = await this.geometrySource.fetchAll();
            logger.info(`Cached ${this.features.length} postal code features`);
        }
        return this.features;
    }

    /**
     * Build a map of municipality name → municipality code from WFS data.
     * Municipality names come from postal code area names, but WFS only gives
     * us the municipality *code* per feature. We use Tilastokeskus's known
     * municipality code mapping.
     *
     * Since WFS doesn't directly include municipality names, we derive them
     * from the known MUNICIPALITY_NAMES mapping (passed in or built externally).
     */
    async getMunicipalityCodeMap(): Promise<Map<string, string>> {
        const features = await this.ensureFeatures();
        // WFS gives us unique municipality codes — collect them
        const codes = new Set<string>();
        for (const f of features) {
            codes.add(f.municipality);
        }
        return new Map(); // Not directly available from WFS alone
    }

    /**
     * Resolve municipality names to postal codes.
     *
     * @param municipalityNames List of municipality names (e.g. ['Helsinki', 'Tampere'])
     * @param municipalityNameToCode Mapping of name → municipality code (e.g. 'Helsinki' → '091')
     * @returns Map of municipality name → sorted postal code array
     * @throws Error if any municipality name cannot be resolved to a code
     */
    async resolve(
        municipalityNames: string[],
        municipalityNameToCode: ReadonlyMap<string, string>,
    ): Promise<Map<string, string[]>> {
        const features = await this.ensureFeatures();

        // Validate all names resolve to codes
        const missingNames: string[] = [];
        const codeToName = new Map<string, string>();

        for (const name of municipalityNames) {
            const code = municipalityNameToCode.get(name);
            if (!code) {
                missingNames.push(name);
            } else {
                codeToName.set(code, name);
            }
        }

        if (missingNames.length > 0) {
            throw new Error(
                `Unknown municipality names (no code mapping found): ${missingNames.join(', ')}. ` +
                `Add them to MUNICIPALITY_NAME_TO_CODE in fetchConfig.ts`
            );
        }

        // Group postal codes by municipality code
        const result = new Map<string, string[]>();
        for (const name of municipalityNames) {
            result.set(name, []);
        }

        const targetCodes = new Set(codeToName.keys());

        for (const feature of features) {
            if (targetCodes.has(feature.municipality)) {
                const name = codeToName.get(feature.municipality)!;
                result.get(name)!.push(feature.postalCode);
            }
        }

        // Sort postal codes and log stats
        for (const [name, codes] of result) {
            codes.sort();
            logger.info(`${name}: ${codes.length} postal codes`);
        }

        return result;
    }

    /**
     * Convenience: resolve municipality names to a flat sorted array of postal codes.
     */
    async resolveFlat(
        municipalityNames: string[],
        municipalityNameToCode: ReadonlyMap<string, string>,
    ): Promise<string[]> {
        const map = await this.resolve(municipalityNames, municipalityNameToCode);
        const all: string[] = [];
        for (const codes of map.values()) {
            all.push(...codes);
        }
        return all.sort();
    }
}
