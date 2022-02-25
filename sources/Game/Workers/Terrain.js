import SimplexNoise from './SimplexNoise.js'
import { vec3 } from 'gl-matrix'

let elevationRandom = null

const linearStep = (edgeMin, edgeMax, value) =>
{
    return Math.max(0.0, Math.min(1.0, (value - edgeMin) / (edgeMax - edgeMin)))
}

const getElevation = (x, y, lacunarity, persistence, iterations, baseFrequency, baseAmplitude, power, elevationOffset, iterationsOffsets) =>
{
    let elevation = 0
    let frequency = baseFrequency
    let amplitude = 1
    let normalisation = 0

    for(let i = 0; i < iterations; i++)
    {
        const noise = elevationRandom.noise2D(x * frequency + iterationsOffsets[i][0], y * frequency + iterationsOffsets[i][1])
        elevation += noise * amplitude

        normalisation += amplitude
        amplitude *= persistence
        frequency *= lacunarity
    }

    elevation /= normalisation
    elevation = Math.pow(Math.abs(elevation), power) * Math.sign(elevation)
    elevation *= baseAmplitude
    elevation += elevationOffset

    return elevation
}

onmessage = function(event)
{
    const id = event.data.id
    const size = event.data.size
    const baseX = event.data.x
    const baseZ = event.data.z
    const seed = event.data.seed
    const subdivisions = event.data.subdivisions
    const lacunarity = event.data.lacunarity
    const persistence = event.data.persistence
    const iterations = event.data.iterations
    const baseFrequency = event.data.baseFrequency
    const baseAmplitude = event.data.baseAmplitude
    const power = event.data.power
    const elevationOffset = event.data.elevationOffset
    const iterationsOffsets = event.data.iterationsOffsets
    
    const segments = subdivisions + 1
    elevationRandom = new SimplexNoise(seed)
    const grassRandom = new SimplexNoise(seed)

    /**
     * Elevation
     */
    const overflowElevations = new Float32Array((segments + 1) * (segments + 1)) // Bigger to calculate normals more accurately
    const elevations = new Float32Array(segments * segments)
    
    for(let iX = 0; iX < segments + 1; iX++)
    {
        const x = baseX + (iX / subdivisions - 0.5) * size

        for(let iZ = 0; iZ < segments + 1; iZ++)
        {
            const z = baseZ + (iZ / subdivisions - 0.5) * size
            const elevation = getElevation(x, z, lacunarity, persistence, iterations, baseFrequency, baseAmplitude, power, elevationOffset, iterationsOffsets)

            const i = iX * (segments + 1) + iZ
            overflowElevations[i] = elevation

            if(iX < segments && iZ < segments)
            {
                const i = iX * segments + iZ
                elevations[i] = elevation
            }
        }
    }

    /**
     * Positions
     */
    const skirtCount = subdivisions * 4 + 4
    const positions = new Float32Array(segments * segments * 3 + skirtCount * 3)

    for(let iX = 0; iX < segments; iX++)
    {
        const x = baseX + (iX / subdivisions - 0.5) * size

        for(let iZ = 0; iZ < segments; iZ++)
        {
            const z = baseZ + (iZ / subdivisions - 0.5) * size
            const elevation = elevations[iX * segments + iZ]

            const iStride = (iX * segments + iZ) * 3
            positions[iStride    ] = x
            positions[iStride + 1] = elevation
            positions[iStride + 2] = z
        }
    }
    
    /**
     * Normals
     */
    const normals = new Float32Array(segments * segments * 3 + skirtCount * 3)
    
    const interSegmentX = - size / subdivisions
    const interSegmentZ = - size / subdivisions

    for(let iX = 0; iX < segments; iX++)
    {
        for(let iZ = 0; iZ < segments; iZ++)
        {
            // Indexes
            const iOverflowStride = iX * (segments + 1) + iZ

            // Elevations
            const currentElevation = overflowElevations[iOverflowStride]
            const neighbourXElevation = overflowElevations[iOverflowStride + segments + 1]
            const neighbourZElevation = overflowElevations[iOverflowStride + 1]

            // Deltas
            const deltaX = vec3.fromValues(
                interSegmentX,
                currentElevation - neighbourXElevation,
                0
            )

            const deltaZ = vec3.fromValues(
                0,
                currentElevation - neighbourZElevation,
                interSegmentZ
            )

            // Normal
            const normal = vec3.create()
            vec3.cross(normal, deltaZ, deltaX)
            vec3.normalize(normal, normal)

            const iStride = (iX * segments + iZ) * 3
            normals[iStride    ] = normal[0]
            normals[iStride + 1] = normal[1]
            normals[iStride + 2] = normal[2]
        }
    }

    /**
     * UV
     */
    const uv = new Float32Array(segments * segments * 2 + skirtCount * 2)

    for(let iX = 0; iX < segments; iX++)
    {
        for(let iZ = 0; iZ < segments; iZ++)
        {
            const iStride = (iX * segments + iZ) * 2
            uv[iStride    ] = iX / (segments - 1)
            uv[iStride + 1] = iZ / (segments - 1)
        }
    }

    /**
     * Indices
     */
    const indicesCount = subdivisions * subdivisions
    const indices = new (indicesCount < 65535 ? Uint16Array : Uint32Array)(indicesCount * 6 + subdivisions * 4 * 6 * 4)
    
    for(let iX = 0; iX < subdivisions; iX++)
    {
        for(let iZ = 0; iZ < subdivisions; iZ++)
        {
            const a = iX * (subdivisions + 1) + (iZ + 1)
            const b = iX * (subdivisions + 1) + iZ
            const c = (iX + 1) * (subdivisions + 1) + iZ
            const d = (iX + 1) * (subdivisions + 1) + (iZ + 1)

            const iStride = (iX * subdivisions + iZ) * 6
            indices[iStride    ] = d
            indices[iStride + 1] = b
            indices[iStride + 2] = a

            indices[iStride + 3] = d
            indices[iStride + 4] = c
            indices[iStride + 5] = b
        }
    }
    
    /**
     * Skirt
     */
    let skirtIndex = segments * segments
    let indicesSkirtIndex = segments * segments
    for(let iZ = 0; iZ < segments; iZ++)
    {
        const iPosition = (0 * segments + iZ)
        const iPositionStride = iPosition * 3

        // Position
        positions[skirtIndex * 3    ] = positions[iPositionStride + 0]
        positions[skirtIndex * 3 + 1] = positions[iPositionStride + 1] - 15
        positions[skirtIndex * 3 + 2] = positions[iPositionStride + 2]

        // Normal
        normals[skirtIndex * 3    ] = normals[iPositionStride + 0]
        normals[skirtIndex * 3 + 1] = normals[iPositionStride + 1]
        normals[skirtIndex * 3 + 2] = normals[iPositionStride + 2]
        
        // UV
        uv[skirtIndex * 2    ] = 0
        uv[skirtIndex * 2 + 1] = iZ / (segments - 1)

        // Index
        if(iZ < segments - 1)
        {
            const a = iPosition
            const b = iPosition + 1
            const c = skirtIndex
            const d = skirtIndex + 1

            const iIndexStride = indicesSkirtIndex * 6
            indices[iIndexStride    ] = a
            indices[iIndexStride + 1] = d
            indices[iIndexStride + 2] = b

            indices[iIndexStride + 3] = d
            indices[iIndexStride + 4] = a
            indices[iIndexStride + 5] = c

            indicesSkirtIndex++
        }

        skirtIndex++
    }
    
    for(let iZ = 0; iZ < segments; iZ++)
    {
        const iX = segments - 1
        const iPosition = iX * segments + iZ
        const iPositionStride = iPosition * 3

        // Position
        positions[skirtIndex * 3    ] = positions[iPositionStride + 0]
        positions[skirtIndex * 3 + 1] = positions[iPositionStride + 1] - 15
        positions[skirtIndex * 3 + 2] = positions[iPositionStride + 2]

        // Normal
        normals[skirtIndex * 3    ] = normals[iPositionStride + 0]
        normals[skirtIndex * 3 + 1] = normals[iPositionStride + 1]
        normals[skirtIndex * 3 + 2] = normals[iPositionStride + 2]
        
        // UV
        uv[skirtIndex * 2    ] = iX / (segments - 1)
        uv[skirtIndex * 2 + 1] = iZ / (segments - 1)

        // Index
        if(iZ < segments - 1)
        {
            const a = iPosition
            const b = iPosition + 1
            const c = skirtIndex
            const d = skirtIndex + 1

            const iIndexStride = indicesSkirtIndex * 6
            indices[iIndexStride    ] = b
            indices[iIndexStride + 1] = c
            indices[iIndexStride + 2] = a

            indices[iIndexStride + 3] = c
            indices[iIndexStride + 4] = b
            indices[iIndexStride + 5] = d

            indicesSkirtIndex++
        }
        
        skirtIndex++
    }

    for(let iX = 0; iX < segments; iX++)
    {
        const iZ = 0
        const iPosition = (iX * segments + iZ)
        const iPositionStride = iPosition * 3

        // Position
        positions[skirtIndex * 3    ] = positions[iPositionStride + 0]
        positions[skirtIndex * 3 + 1] = positions[iPositionStride + 1] - 15
        positions[skirtIndex * 3 + 2] = positions[iPositionStride + 2]

        // Normal
        normals[skirtIndex * 3    ] = normals[iPositionStride + 0]
        normals[skirtIndex * 3 + 1] = normals[iPositionStride + 1]
        normals[skirtIndex * 3 + 2] = normals[iPositionStride + 2]
        
        // UV
        uv[skirtIndex * 2    ] = iX / (segments - 1)
        uv[skirtIndex * 2 + 1] = 0

        // Index
        if(iX < segments - 1)
        {
            const a = iPosition
            const b = iPosition + segments
            const c = skirtIndex
            const d = skirtIndex + 1

            const iIndexStride = indicesSkirtIndex * 6
            indices[iIndexStride    ] = b
            indices[iIndexStride + 1] = c
            indices[iIndexStride + 2] = a

            indices[iIndexStride + 3] = c
            indices[iIndexStride + 4] = b
            indices[iIndexStride + 5] = d

            indicesSkirtIndex++
        }

        skirtIndex++
    }

    for(let iX = 0; iX < segments; iX++)
    {
        const iZ = segments - 1
        const iPosition = (iX * segments + iZ)
        const iPositionStride = iPosition * 3

        // Position
        positions[skirtIndex * 3    ] = positions[iPositionStride + 0]
        positions[skirtIndex * 3 + 1] = positions[iPositionStride + 1] - 15
        positions[skirtIndex * 3 + 2] = positions[iPositionStride + 2]

        // Normal
        normals[skirtIndex * 3    ] = normals[iPositionStride + 0]
        normals[skirtIndex * 3 + 1] = normals[iPositionStride + 1]
        normals[skirtIndex * 3 + 2] = normals[iPositionStride + 2]
        
        // UV
        uv[skirtIndex * 2    ] = iX / (segments - 1)
        uv[skirtIndex * 2 + 1] = iZ / (segments - 1)

        // Index
        if(iX < segments - 1)
        {
            const a = iPosition
            const b = iPosition + segments
            const c = skirtIndex
            const d = skirtIndex + 1

            const iIndexStride = indicesSkirtIndex * 6
            indices[iIndexStride    ] = a
            indices[iIndexStride + 1] = d
            indices[iIndexStride + 2] = b

            indices[iIndexStride + 3] = d
            indices[iIndexStride + 4] = a
            indices[iIndexStride + 5] = c

            indicesSkirtIndex++
        }

        skirtIndex++
    }

    /**
     * Texture
     */
    const texture = new Float32Array(segments * segments * 4)

    for(let iX = 0; iX < segments; iX++)
    {
        for(let iZ = 0; iZ < segments; iZ++)
        {
            const iPositionStride = (iX + iZ * segments) * 3
            const position = vec3.fromValues(
                positions[iPositionStride    ],
                positions[iPositionStride + 1],
                positions[iPositionStride + 2]
            )

            // Normal
            const iNormalStride = (iX + iZ * segments) * 3
            const normal = vec3.fromValues(
                normals[iNormalStride    ],
                normals[iNormalStride + 1],
                normals[iNormalStride + 2]
            )

            // Grass
            const upward = Math.max(0, normal[1])
            let grass = 0;

            if(position[1] > 0)
            {
                const grassFrequency = 0.05
                let grassNoise = grassRandom.noise2D(position[0] * grassFrequency + iterationsOffsets[0][0], position[2] * grassFrequency + iterationsOffsets[0][0])
                grassNoise = linearStep(- 0.5, 0, grassNoise);
                
                const grassUpward = linearStep(0.9, 1, upward);
                
                grass = grassNoise * grassUpward
            }

            // Final texture
            const iTextureStride = (iX * segments + iZ) * 4
            texture[iTextureStride    ] = 0
            texture[iTextureStride + 1] = grass
            texture[iTextureStride + 2] = 0
            texture[iTextureStride + 3] = position[1]
        }
    }

    // Post
    postMessage({
        id: id,
        positions: positions,
        normals: normals,
        indices: indices,
        texture: texture,
        uv: uv
    })
}