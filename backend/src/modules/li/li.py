from pytrends.request import TrendReq

pytrend = TrendReq(hl='uk-UA', tz=120)

kw_list = ["Інфляція", "Кредит"]


pytrend.build_payload(kw_list, cat=0, timeframe='today 12-m', geo='UA', gprop='')

df = pytrend.interest_over_time()

print(df.head())