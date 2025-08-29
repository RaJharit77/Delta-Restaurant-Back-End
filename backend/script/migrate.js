import { PrismaClient } from '@prisma/client'
import { v4 as uuidv4 } from 'uuid'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const prisma = new PrismaClient()

async function main() {
    const dataPath = path.resolve(__dirname, 'data/data.json')
    console.log('Chemin du fichier data:', dataPath)

    const menuData = JSON.parse(fs.readFileSync(dataPath, 'utf8'))

    console.log('Début de la migration des données...')

    for (const item of menuData) {
        await prisma.menu.create({
            data: {
                id: uuidv4(),
                name: item.name,
                description: item.description,
                price: item.price,
                image: item.image
            }
        })
        console.log(`Item migré: ${item.name}`)
    }

    console.log('Migration terminée avec succès!')
}

main()
    .catch(e => {
        console.error('Erreur lors de la migration:', e)
        process.exit(1)
    })
    .finally(async () => {
        await prisma.$disconnect()
    })