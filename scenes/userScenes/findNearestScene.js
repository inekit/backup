const { Telegraf, Composer, Scenes: { WizardScene } } = require('telegraf')
const { CustomWizardScene, } = require('telegraf-steps-engine')
const tOrmCon = require("../../db/data-source");
const addEntryHandler = new Composer(),cityHandler = new Composer(),coordinatesHandler = new Composer(), fullListHandler = new Composer()
const Nominatim = require('nominatim-geocoder')
const geocoder = new Nominatim()
const stat = require("../../Utils/statistics")

const findNearestScene = new WizardScene('findNearestScene',cityHandler,coordinatesHandler,fullListHandler)
.enter(async ctx=>{

    const connection = await tOrmCon

    const cities = ctx.scene.state.cities = await connection.getRepository("City")
    .find().catch((e)=>{ console.log(e);ctx.replyWithTitle("DB_ERROR") })

    const keyboard = { name: 'cities_list_keyboard', args: [cities] }
    const title = "CHOOSE_CITY"

    await ctx.replyWithKeyboard('⚙️', 'main_menu_back_keyboard')

    return ctx.replyWithKeyboard(title, keyboard)
    
    
})


cityHandler.action(/^city\-([0-9]+)$/g, async ctx => {

    await ctx.answerCbQuery().catch(console.log)

    if (!ctx.wizard.state.input) ctx.wizard.state.input = {}

    ctx.wizard.state.input.city_id = ctx.match[1]

    ctx.wizard.state.city = ctx.scene.state.cities?.find((el, i) => el.id === parseInt(ctx.match[1]))?.name

    ctx.replyWithKeyboard('ENTER_LOCATION_ADDRESS', 'send_location_keyboard', [ctx.wizard.state.city]);

    ctx.wizard.next()

})


function getNearestPoints(longitude, latitude, cityId){
    return new Promise(async (res, rej)=>{
        const connection = await tOrmCon

        const points = await connection
        .query(`select a.id pointId, a.name pointName, c.name cityName, street, house, building, latitude,longitude, 
        ST_Distance_Sphere(point(?, ?), point(longitude,latitude)) distance 
        from (select id,name, cityId,street, house, building,longitude,latitude from navigator.addresses) a
        inner join navigator.cities c on c.id = a.cityId WHERE a.cityId=?
        order by distance`,[longitude,latitude, cityId])
        .catch((e)=>{ console.log(e); rej("DB_ERROR") })

        if (!points?.length) rej("NO_POINTS")

        res(points)
    })
}

async function sendPointsList(ctx, points){
    if (!points?.length) return ctx.replyWithTitle('NO_POINTS');

    const firstPoints = points?.slice(0,2);

    await ctx.replyWithKeyboard('TWO_POINTS_SEND',{
        name: 'main_menu_back_keyboard', 
        args: [['BUTTON_SHOW_MORE'],['show_more']]});

    const compileAddrStr = (p)=> `Ул. ${p.street}, д. ${p.house}${p.building? ', к. '+p.building : "" }`;

    for (i in firstPoints){
        console.log(i, firstPoints[i])
        let p=firstPoints[i]
        await ctx.telegram.sendLocation(ctx.from.id, p.latitude, p.longitude).catch(console.log)
        if (i==firstPoints.length-1 && i < points.length-1) {
            await ctx.replyWithKeyboard('POINT_INFO',{
                name: 'custom_keyboard', 
                args: [['BUTTON_SHOW_MORE'],['show_more']]},
                [p.pointName, Math.trunc( p.distance ), compileAddrStr(p)])
            return ctx.wizard.next()

        } 
        else await ctx.replyWithTitle('POINT_INFO',
         [p.pointName, Math.trunc( p.distance ),  compileAddrStr(p)])

    }
}

coordinatesHandler.on('location', async ctx => {
    if(!ctx.message.location) return;


    let {latitude, longitude} = ctx.message.location
    await ctx.replyWithTitle('⚙️')

    const points = await getNearestPoints(longitude, latitude, ctx.wizard.state.input.city_id )
     .catch(e=>{
         ctx.replyWithTitle('NO_POINTS').catch(e=>{})
         ctx.scene.reenter()
        })

    if (!points?.length) return
    
    ctx.wizard.state.input.points = points;

    stat.increaseCart(ctx.from?.id).catch(e=>{ctx.replyWithTitle(e.message)})

    sendPointsList(ctx, points)
})

coordinatesHandler.on('text',async (ctx)=>{
    const address = ctx.message?.text

    const addrReg = /^([а-яА-ЯЁё]{2,255})\s([0-9\/\.]{1,5})(\s([\wа-яА-ЯЁё0-9]{1,2}))?$/g.exec(address)

    if (!addrReg) return ctx.replyWithTitle("WRONG_ADDR_FORMAT")

    await ctx.replyWithTitle('⚙️')

    geocoder.search( { street: addrReg?.[0], city: ctx.wizard.state.city, countrycodes:"ru", limit:5 } )
    .then(async (geoInfo) => {
        if (!geoInfo || !geoInfo.length) return ctx.replyWithTitle("CANT RECOGNIZE ADDRESS")

        const {latitude, longitude, city_id} = ctx.scene.state.input = {
            city_id: ctx.wizard.state.input.city_id,
            latitude:geoInfo[0]?.lat,
            longitude:geoInfo[0]?.lon,
        }


        const points = await getNearestPoints(longitude, latitude, city_id )
        .catch(e=>{
            ctx.replyWithTitle('NO_POINTS').catch(e=>{})
            ctx.scene.reenter()
           })

        if (!points?.length) return

        ctx.wizard.state.input.points = points;

        stat.increaseCart(ctx.from?.id).catch(e=>{ctx.replyWithTitle(e.message)})

        sendPointsList(ctx, points)
        })
    .catch((error) => {
        console.log(error)
        return ctx.replyWithTitle("CANT RECOGNIZE ADDRESS")
    })
    
})


fullListHandler.action("show_more", async ctx => {

    await ctx.answerCbQuery().catch(console.log)

    ctx.wizard.state.page=1;

    const points = ctx.wizard.state.input?.points

    const take = ctx.wizard.state.take = 10;

    ctx.replyWithKeyboard('FULL_POINT_INFO',{name: 'show_more_points_keyboard', args: [points?.slice(0,take), 1, points.length>take]})

})

fullListHandler.action(/^point\-([0-9]+)$/g, async ctx => {

    await ctx.answerCbQuery().catch(console.log)

    if (!ctx.wizard.state.input) ctx.wizard.state.input = {}

    ctx.wizard.state.input.point_id = ctx.match[1]

    const points = ctx.wizard.state.input?.points;

    console.log(points, parseInt(ctx.match[1]))

    const p = points?.find((el, i) => el.pointId === parseInt(ctx.match[1]))

    if (!p || !p?.pointId) return

    await ctx.telegram.sendLocation(ctx.from.id, p.latitude, p.longitude).catch(console.log)

    await ctx.replyWithTitle('POINT_INFO',
        [p.pointName, Math.trunc( p.distance ), `Ул. ${p.street}, д. ${p.house}${p.building? ', к. '+p.building : "" }`])

})

fullListHandler.action("next", async ctx => {

    await ctx.answerCbQuery().catch(console.log)

    const points = ctx.wizard.state.input?.points

    const take = ctx.wizard.state.take;

    let page = ctx.wizard.state.page;

    if (points?.length<=take*(page)) return;

    page = ++ctx.wizard.state.page;

    ctx.editMenu('FULL_POINT_INFO',{
        name: 'show_more_points_keyboard', 
        args: [points?.slice((page-1)*take,page*take),page, true]
    })

})

fullListHandler.action("previous", async ctx => {

    await ctx.answerCbQuery().catch(console.log)

    const points = ctx.wizard.state.input?.points

    const take = ctx.wizard.state.take;

    let page = ctx.wizard.state.page;

    if (ctx.wizard.state.page<2) return;

    page = --ctx.wizard.state.page;


    ctx.editMenu('FULL_POINT_INFO',{
        name: 'show_more_points_keyboard', 
        args: [points?.slice((page-1)*take,(page)*take),page,true]
    })

})


module.exports = [findNearestScene]
