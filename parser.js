const points = require("./points.json");
const Nominatim = require('nominatim-geocoder')
const db = require('./db/dbClient')
const geocoder = new Nominatim()
const conn = db.createConnection()


async function parseCity({city, street, house, building,name}){
    const addr = `${street} ${house}${building? ' '+building :""}`
    const r = await geocoder.search( { street: addr, city: city, countrycodes:"ru", limit:5 } )
        .then(async (response) => {
            //console.log(city, addr, response[0]?.display_name, response[0]?.lat,response[0]?.lon,)
            if (!response[0]?.lat || !response[0]?.lon) return {city, street, house, building,name}//console.log(city, addr, response[0]?.display_name, response[0]?.lat,response[0]?.lon,)
            else
            conn.query(`insert into addresses (cityId, name, street, house, building, latitude, longitude)
            values ((select id from navigator.cities c where c.name = ? limit 1), 
                ?,?,?,?,?,?
                )`,
                [city.trim(), name, street, house, building, response[0]?.lat, response[0]?.lon])
            
        })

    return r
}

const cities = new Set()

async function parseCities(){
    points?.["Лист1"].forEach(async p=>{
        console.log(0)
        
        await cities.add(p.city.trim())
    })
}

async function insertCities(){
    cities.forEach(async c=>{
        conn.query('insert into navigator.cities (name) values (?)',[c])
       })
}

async function deletePoints(){
    await conn.query('delete from navigator.addresses where 1=1')
}


async function parsePoints(){
    const unresolved = new Set()
    console.log(1)
    points?.["Лист1"].forEach(async point => {
        unresolved.add(await parseCity(point))
        console.log(unresolved)

    });
}

async function parse(){
    await parseCities()

    await insertCities()

    await deletePoints()
    
    await parsePoints()

}

parse()



/*
cities.forEach(async c=>{
     conn.query('insert into navigator.cities (name) values (?)',[c])
    }) */


/*
*/