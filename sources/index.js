import Registry from '@/Registry.js'

import '@/EventEmitter.js'
import '@/Game.js'

import '@/Debug/Debug.js'
import '@/Debug/Stats.js'
import '@/Debug/UI.js'

import '@/Engine/Time.js'
import '@/Engine/Viewport.js'
import '@/Engine/Controls.js'
import '@/Engine/Chunk.js'
import '@/Engine/Chunks.js'
import '@/Engine/Day.js'
import '@/Engine/Player.js'
import '@/Engine/Camera.js'
import '@/Engine/CameraFly.js'
import '@/Engine/CameraThirdPerson.js'
import '@/Engine/Engine.js'
import '@/Engine/Sun.js'
import '@/Engine/Terrain.js'
import '@/Engine/Terrains.js'

import '@/View/Camera.js'
import '@/View/Chunk.js'
import '@/View/ChunkHelper.js'
import '@/View/Chunks.js'
import '@/View/Grass.js'
import '@/View/Noises.js'
import '@/View/Player.js'
import '@/View/View.js'
import '@/View/Renderer.js'
import '@/View/Sky.js'
import '@/View/Terrain.js'
import '@/View/TerrainGradient.js'
import '@/View/Terrains.js'
import '@/View/Water.js'

import '@/View/Materials/Grass.js'
import '@/View/Materials/Noises.js'
import '@/View/Materials/SkyBackground.js'
import '@/View/Materials/SkySphere.js'
import '@/View/Materials/Stars.js'
import '@/View/Materials/Terrain.js'
import '@/View/Materials/Player.js'


window.world = new Registry.Game({
    domElement: document.querySelector('.game')
})