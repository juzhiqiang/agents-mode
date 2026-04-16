import { HttpException, HttpStatus } from "@nestjs/common";
import { firstValueFrom } from 'rxjs';
import { HttpService } from '@nestjs/axios';


export default async function getWeather(city: string): Promise<string> {
    const url = `https://wttr.in/${city}?format=j1`;
    const httpService = new HttpService();

    try {
        // 在 NestJS 中，httpService 返回的是 Observable
        // 我们用 firstValueFrom 把它转成类似 Python requests 的异步行为
        const { data }: any = await firstValueFrom(httpService.get(url));

        const currentCondition = data.current_condition[0];
        const weatherDesc = currentCondition.weatherDesc[0].value;
        const tempC = currentCondition.temp_C;

        return `${city}当前天气: ${weatherDesc}，气温 ${tempC} 摄氏度`;
    } catch (error) {
        throw new HttpException(
            `查询天气失败: ${error.message}`,
            HttpStatus.BAD_GATEWAY,
        );
    }
}