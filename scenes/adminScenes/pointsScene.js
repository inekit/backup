const { Telegraf, Composer, Scenes: { WizardScene } } = require('telegraf')
const titles = require('telegraf-steps-engine/middlewares/titles')
const moment=require("moment")
const deleteHandler = new Composer(),
confirmHandler = new Composer();

const scene = new WizardScene('pointsScene', deleteHandler, confirmHandler)

const tOrmCon = require("../../db/data-source");

scene.enter(async ctx => {

    const { edit, main_menu_button } = ctx.scene.state

    const connection = await tOrmCon
    ctx.scene.state.points = 
     await connection.query(`select *
     from navigator.addresses p, navigator.admins b
     where b.userId = ? and p.cityId = ? order by p.name`,[ctx.from.id, ctx.scene.state.cityId])
     .catch((e)=>{ console.log(e);ctx.replyWithTitle("DB_ERROR") })


     if (!ctx.scene.state.points) ctx.scene.enter('clientScene')

     ctx.scene.state.page = 1;
     const keyboard = {name: 'points_list_admin_keyboard', args: [ctx.scene.state.points, ctx.scene.state.page]}
 
     const title = ctx.scene.state.points.length ? ctx.getTitle("CHOOSE_POINT") : ctx.getTitle("NO_POINTS_YET")
 
     if (main_menu_button) await ctx.replyWithKeyboard('⚙️', main_menu_button)
 
     if (edit) return ctx.editMenu(title, keyboard)
    ctx.replyWithKeyboard(title, keyboard)
})

scene.action('previous', async ctx => {
    ctx.answerCbQuery().catch(console.log)
    if (ctx.scene.state.page===1) return;

    const keyboard = {name: 'points_list_admin_keyboard', args: [ctx.scene.state.points,--ctx.scene.state.page]}

    const title = ctx.scene.state.points.length ? ctx.getTitle("CHOOSE_POINT") : ctx.getTitle("NO_POINTS_YET")

    return ctx.editMenu(title, keyboard)})

scene.action('next', async ctx => {
    if (ctx.scene.state.page*50 > ctx.scene.state.points?.length) return;


    const keyboard = {name: 'points_list_admin_keyboard', args: [ctx.scene.state.points,++ctx.scene.state.page]}
 
    const title = ctx.scene.state.points.length ? ctx.getTitle("CHOOSE_POINT") : ctx.getTitle("NO_POINTS_YET")

    return ctx.editMenu(title, keyboard)})

scene.action('add_point', async ctx => {
    ctx.scene.enter('pointAddingScene',{city: ctx.scene.state.city, cityId: ctx.scene.state.cityId});
})

scene.action('back', async ctx => {
    ctx.scene.enter('citiesScene',{city: ctx.scene.state.city, cityId: ctx.scene.state.cityId});
})

scene.action(/^point\-([0-9]+)$/g, async ctx => {

    const selectedId = ctx.scene.state.selectedId = ctx.match[1];

    const pointsInfo = 
     await (await tOrmCon).query(`select *
     from navigator.addresses p, navigator.admins b
     where b.userId = ? and p.id = ?`,[ctx.from.id, selectedId])
     .catch((e)=>{console.log(e); return ctx.editMenu(ctx.getTitle("DB_ERROR")) })

     if (!pointsInfo || !pointsInfo.length) ctx.editMenu(ctx.getTitle("NO_POINT_INFO"))

    const pointInfo = pointsInfo?.[0];

    await ctx.telegram.sendLocation(ctx.from.id, pointInfo.latitude, pointInfo.longitude).catch(console.log)

    ctx.replyWithKeyboard("POINT_ADMIN_INFO", 
     {name: "custom_keyboard", args: [["BUTTON_DELETE", "BUTTON_BACK"],['delete', 'back']]}, [
        pointInfo?.name,
        ctx.scene.state.city,
        `Ул. ${pointInfo.street}, д. ${pointInfo.house}${pointInfo.building? ', к. '+pointInfo.building : "" }`
        ]);


})


deleteHandler.action('delete', async ctx => {

    ctx.editMenu(ctx.getTitle("CONFIRM"), 'confirm_keyboard');

})

deleteHandler.action('back', async ctx => {

    ctx.scene.reenter({edit:true})

})

deleteHandler.action('confirm', async ctx => {

    const res = await require('../../Utils/authAdmin')(ctx.from.id)
    .catch(()=>{ ctx.answerCbQuery("CANT_AUTH");return ctx.scene.enter('clientScene');})


    if (!res) { return ctx.scene.enter('clientScene');}

    const connection = await tOrmCon
    await connection.getRepository("Address").delete({id: ctx.scene.state.selectedId})
    .then(async ()=>{
        await ctx.answerCbQuery("POINT_HAS_BEEN_REMOVED").catch(console.log)
    })
    .catch(async (e)=>{ 
        console.log(e)
        await ctx.answerCbQuery("POINT_HAS_NOT_BEEN_REMOVED").catch(console.log) 
    })

    delete ctx.scene.state.deletingId

    return ctx.scene.reenter({edit:true})

})

module.exports = scene